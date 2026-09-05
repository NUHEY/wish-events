\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wish_events_security_test' THEN RAISE EXCEPTION 'Disposable test database required'; END IF; END $$;
alter table public.feature_flags add column show_on_home boolean default false;
alter table public.notifications add column actor_id uuid,add column type text,add column link text,add column preview_text text,add column sender_label text;
\i :wisdom_definitions_file
\ir ../../supabase/migrations/20260905120000_enforce_active_accounts.sql
insert into auth.users(id,email,raw_app_meta_data) values
 ('90000000-0000-0000-0000-000000000001','wisdom-ra@waseda.jp','{}'),
 ('90000000-0000-0000-0000-000000000002','wisdom-author@waseda.jp','{}'),
 ('90000000-0000-0000-0000-000000000003','wisdom-peer@waseda.jp','{}'),
 ('90000000-0000-0000-0000-000000000004','wisdom-desk@wish-events.local','{"account_kind":"service_desk"}');
update public.users set role='ra' where id='90000000-0000-0000-0000-000000000001';
insert into public.feature_flags(key,state) values('wish_knowledge','hidden'),('ra_question_box','public');
insert into public.ra_questions(id,asked_by,question,is_anonymous,is_public,answer,answered_by) values
 ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','Private legacy',true,false,'Private response','90000000-0000-0000-0000-000000000001'),
 ('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','Public anonymous legacy',true,true,'Public response',null),
 ('91000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000002','Unanswered legacy',false,true,null,null);
delete from public.notifications;
\ir ../../supabase/migrations/20260906130000_unify_wish_question_privacy.sql
\ir ../../supabase/migrations/20260906130000_unify_wish_question_privacy.sql
CREATE FUNCTION pg_temp.assert_true(p_check boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF p_check IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_message; END IF; END $$;
select pg_temp.assert_true((select count(*)=3 from public.wish_questions),'Legacy import duplicated/lost rows');
select pg_temp.assert_true((select count(*)=2 from public.wish_answers),'Legacy answers duplicated/lost');
select pg_temp.assert_true((select count(*)=0 from public.notifications),'Import sent notifications');
select pg_temp.assert_true((select state='public' from public.feature_flags where key='wish_knowledge'),'Enabled old box became inaccessible');
select pg_temp.assert_true((select visibility='ra_only' from public.wish_questions where title='Unanswered legacy'),'Unanswered legacy was published');
update public.institutional_permissions set permissions=array['questions'] where account_kind='service_desk';
BEGIN;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.wish_question_feed()),'Peer saw private legacy questions');
select pg_temp.assert_true((select asked_by is null and legacy_ra_question_id is null from public.wish_question_feed() where title='Public anonymous legacy'),'Anonymous identity leaked in feed');
select pg_temp.assert_true((select count(*)=0 from public.wish_questions),'Anonymous identity leaked in raw rows');
select pg_temp.assert_true((select count(*)=1 from public.wish_answers),'Private answer leaked');
DO $$ DECLARE qid uuid; BEGIN
 select id into qid from public.wish_question_feed() where title='Public anonymous legacy';
 BEGIN
  insert into public.wish_answers(question_id,answered_by,body) values(qid,auth.uid(),'Unauthorized RA answer');
  raise exception 'Resident answered RA-only question';
 exception when insufficient_privilege then null; end;
 BEGIN
  insert into public.wish_questions(asked_by,title,body,legacy_ra_question_id) values(auth.uid(),'Forged','Forged',gen_random_uuid());
  raise exception 'Client forged import tracking';
 exception when insufficient_privilege then null; end;
 insert into public.wish_questions(asked_by,title,body,visibility,answer_scope,is_anonymous) values(auth.uid(),'New private request','Do not put this private text into notifications','ra_only','ra_only',true);
END $$;
reset role;
select pg_temp.assert_true((select count(*)=1 and bool_and(user_id='90000000-0000-0000-0000-000000000001'::uuid and actor_id is null and preview_text='RAへの質問が届きました') from public.notifications),'Private request notification leaked');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.wish_question_feed()),'Delegated staff saw RA-private content');
select pg_temp.assert_true((select count(*)=0 from public.ra_questions),'Staff could read archive private/anonymous identities');
DO $$ DECLARE qid uuid; BEGIN
 select id into qid from public.wish_question_feed() where title='Public anonymous legacy';
 BEGIN
  insert into public.wish_answers(question_id,answered_by,body) values(qid,auth.uid(),'Not a real RA');
  raise exception 'Delegated staff answered RA-only question';
 exception when insufficient_privilege then null; end;
 perform public.delete_wish_question(qid);
END $$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=2 from public.wish_question_feed()),'Author lost private legacy access');
DO $$ DECLARE qid uuid; aid uuid; BEGIN
 select id into qid from public.wish_question_feed() where title='Private legacy';
 select id into aid from public.wish_answers where question_id=qid;
 perform public.accept_wish_answer(qid,aid);
 BEGIN
  update public.wish_questions set visibility='public' where id=qid;
  raise exception 'Direct privacy change allowed';
 exception when insufficient_privilege then null; end;
 BEGIN
  insert into public.ra_questions(asked_by,question) values(auth.uid(),'Old split path');
  raise exception 'Retired box still accepted writes';
 exception when insufficient_privilege then null; end;
END $$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=3 from public.wish_question_feed()),'Real RA could not read private requests');
insert into public.wish_answers(question_id,answered_by,body) select id,auth.uid(),'Actual RA reply' from public.wish_question_feed() where title='New private request';
reset role;
update public.users set moved_out_at=now() where id='90000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.wish_question_feed()),'Departed RA retained knowledge access');
reset role;
ROLLBACK;
\echo Unified WISH question privacy regressions passed.
