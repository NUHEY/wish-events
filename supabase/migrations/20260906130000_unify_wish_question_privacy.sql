-- Consolidate the RA question box into WISH knowledge without publishing private history.
begin;
alter table public.wish_questions
  add column if not exists visibility text not null default 'public' check (visibility in ('public','ra_only')),
  add column if not exists answer_scope text not null default 'everyone' check (answer_scope in ('everyone','ra_only')),
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists legacy_ra_question_id uuid unique;
alter table public.wish_answers
  add column if not exists legacy_ra_question_id uuid unique;
-- Historical responders may have been deleted; new replies still require auth.uid().
alter table public.wish_answers alter column answered_by drop not null;

-- Import once. Disable only the existing answer notification trigger, within this
-- transaction: importing old answers must not send new notifications.
alter table public.wish_answers disable trigger trg_notify_wish_answer;
insert into public.wish_questions(asked_by,title,body,category,created_at,updated_at,visibility,answer_scope,is_anonymous,legacy_ra_question_id)
select r.asked_by,left(r.question,120),r.question,'other',r.created_at,r.updated_at,
  case when r.is_public and r.answer is not null then 'public' else 'ra_only' end,
  'ra_only',r.is_anonymous,r.id
from public.ra_questions r on conflict(legacy_ra_question_id) do nothing;
insert into public.wish_answers(question_id,answered_by,body,created_at,updated_at,legacy_ra_question_id)
select q.id,r.answered_by,r.answer,coalesce(r.answered_at,r.updated_at),r.updated_at,r.id
from public.ra_questions r join public.wish_questions q on q.legacy_ra_question_id=r.id
where r.answer is not null on conflict(legacy_ra_question_id) do nothing;
update public.wish_questions q set accepted_answer_id=a.id
from public.wish_answers a where q.legacy_ra_question_id=a.legacy_ra_question_id and q.accepted_answer_id is null;
alter table public.wish_answers enable trigger trg_notify_wish_answer;

-- Keep the currently enabled knowledge tool; otherwise carry forward the old box's
-- enabled state. Both hidden stays hidden. Row privacy is independent of this flag.
insert into public.feature_flags(key,state)
select 'wish_knowledge',state from public.feature_flags where key='ra_question_box' and state<>'hidden'
on conflict(key) do update set state=excluded.state where feature_flags.state='hidden';
update public.feature_flags set state='hidden',show_on_home=false where key='ra_question_box';

create or replace function public.is_wish_ra()
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_active_account() and exists(select 1 from public.users u where u.id=auth.uid() and u.account_kind='resident' and u.role='ra');
$$;
create or replace function public.can_read_wish_question(p_question_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_active_account() and exists(select 1 from public.wish_questions q where q.id=p_question_id and (
  q.asked_by=auth.uid() or public.is_wish_ra() or (q.visibility='public' and (public.beta_feature_enabled('wish_knowledge') or public.has_management_permission('questions')))
 ));
$$;
create or replace function public.can_answer_wish_question(p_question_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.can_read_wish_question(p_question_id) and exists(select 1 from public.wish_questions q where q.id=p_question_id and (q.answer_scope='everyone' or public.is_wish_ra()));
$$;
revoke all on function public.is_wish_ra(), public.can_read_wish_question(uuid), public.can_answer_wish_question(uuid) from public,anon;
grant execute on function public.is_wish_ra(), public.can_read_wish_question(uuid), public.can_answer_wish_question(uuid) to authenticated;

-- Replace the legacy permissive policies, retaining active_account_required.
drop policy if exists wish_questions_select on public.wish_questions;
create policy wish_questions_select on public.wish_questions for select to authenticated using(
 public.can_read_wish_question(id) and (not is_anonymous or asked_by=auth.uid() or public.is_wish_ra())
);
drop policy if exists wish_questions_insert on public.wish_questions;
create policy wish_questions_insert on public.wish_questions for insert to authenticated with check(
 asked_by=auth.uid() and public.is_active_account() and (public.is_wish_ra() or public.beta_feature_enabled('wish_knowledge') or public.has_management_permission('questions'))
);
drop policy if exists wish_questions_delete on public.wish_questions;
create policy wish_questions_delete on public.wish_questions for delete to authenticated using(
 public.can_read_wish_question(id) and (asked_by=auth.uid() or public.is_wish_ra() or (visibility='public' and public.has_management_permission('questions')))
);
-- Privacy/ownership cannot be altered with direct UPDATE; authors choose on creation.
revoke insert,update on public.wish_questions from authenticated;
grant insert(asked_by,title,body,category,visibility,answer_scope,is_anonymous) on public.wish_questions to authenticated;

drop policy if exists wish_answers_select on public.wish_answers;
create policy wish_answers_select on public.wish_answers for select to authenticated using(public.can_read_wish_question(question_id));
drop policy if exists wish_answers_insert on public.wish_answers;
create policy wish_answers_insert on public.wish_answers for insert to authenticated with check(answered_by=auth.uid() and public.can_answer_wish_question(question_id));
drop policy if exists wish_answers_delete on public.wish_answers;
create policy wish_answers_delete on public.wish_answers for delete to authenticated using(
 public.can_read_wish_question(question_id) and (answered_by=auth.uid() or public.is_wish_ra() or (public.has_management_permission('questions') and exists(select 1 from public.wish_questions q where q.id=question_id and q.visibility='public')))
);
revoke insert,update on public.wish_answers from authenticated;
grant insert(question_id,answered_by,body) on public.wish_answers to authenticated;

-- Safe read interface for all clients. Anonymous names/IDs never leave the DB for
-- other residents or delegated staff; raw table reads cannot bypass this masking.
create or replace function public.wish_question_feed()
returns setof public.wish_questions language plpgsql stable security definer set search_path=public as $$
declare q public.wish_questions%rowtype;
begin
 if not public.is_active_account() then return; end if;
 for q in select * from public.wish_questions w where public.can_read_wish_question(w.id)
 loop
  if q.is_anonymous and q.asked_by is distinct from auth.uid() and not public.is_wish_ra() then
   q.asked_by:=null; q.legacy_ra_question_id:=null;
  end if;
  return next q;
 end loop;
 return;
end;
$$;
revoke all on function public.wish_question_feed() from public,anon;
grant execute on function public.wish_question_feed() to authenticated;

create or replace function public.delete_wish_question(p_question_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.can_read_wish_question(p_question_id) or not exists(
  select 1 from public.wish_questions q where q.id=p_question_id and (q.asked_by=auth.uid() or public.is_wish_ra() or (q.visibility='public' and public.has_management_permission('questions')))
 ) then raise exception '質問を削除する権限がありません' using errcode='42501'; end if;
 delete from public.wish_questions where id=p_question_id;
end;
$$;
revoke all on function public.delete_wish_question(uuid) from public,anon;
grant execute on function public.delete_wish_question(uuid) to authenticated;

create or replace function public.accept_wish_answer(p_question_id uuid,p_answer_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.can_read_wish_question(p_question_id) or not exists(
  select 1 from public.wish_questions q where q.id=p_question_id and (q.asked_by=auth.uid() or public.is_wish_ra())
 ) then raise exception '回答を選択する権限がありません' using errcode='42501'; end if;
 if not exists(select 1 from public.wish_answers a where a.id=p_answer_id and a.question_id=p_question_id) then raise exception '回答が見つかりません'; end if;
 update public.wish_questions set accepted_answer_id=p_answer_id,updated_at=now() where id=p_question_id;
end;
$$;
revoke all on function public.accept_wish_answer(uuid,uuid) from public,anon;
grant execute on function public.accept_wish_answer(uuid,uuid) to authenticated;

-- The old table is an immutable archive for its author and real RAs only. No new
-- writes or broadcasts can split data back into the retired tool.
revoke insert,update,delete on public.ra_questions from authenticated;
drop policy if exists ra_questions_select_allowed on public.ra_questions;
create policy ra_questions_select_allowed on public.ra_questions for select to authenticated using(public.is_active_account() and (asked_by=auth.uid() or public.is_wish_ra()));

-- Private request notifications go only to active resident RAs. Never put the
-- private body or an anonymous author's ID into notification previews.
create or replace function public.notify_wish_question_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.visibility='ra_only' or new.answer_scope='ra_only' then
  insert into public.notifications(user_id,actor_id,type,link,preview_text,sender_label)
  select u.id,case when new.is_anonymous then null else new.asked_by end,'ra_broadcast','/wisdom/'||new.id::text,
   'RAへの質問が届きました','WISH知恵袋'
  from public.users u where u.account_kind='resident' and u.role='ra' and u.moved_out_at is null and u.id<>new.asked_by;
 end if;
 return new;
end;
$$;
revoke all on function public.notify_wish_question_request() from public,anon,authenticated;
drop trigger if exists trg_notify_wish_question_request on public.wish_questions;
create trigger trg_notify_wish_question_request after insert on public.wish_questions for each row execute function public.notify_wish_question_request();
notify pgrst,'reload schema';
commit;
