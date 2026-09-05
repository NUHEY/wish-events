-- Extends the disposable account + active-account fixtures; never run live.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() <> 'wish_events_security_test' THEN RAISE EXCEPTION 'Disposable test database required'; END IF;
END $$;
ALTER TABLE public.users ADD COLUMN is_new_resident boolean DEFAULT false, ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN wish_entry_month date;
ALTER TABLE storage.objects ADD COLUMN bucket_id text;
CREATE TABLE public.announcements(id uuid PRIMARY KEY, created_by uuid REFERENCES public.users(id));
CREATE TABLE public.feature_flags(key text PRIMARY KEY, state text, updated_by uuid);
CREATE TABLE public.site_settings(id integer PRIMARY KEY, updated_by uuid);
CREATE TABLE public.schedule_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), share_token uuid DEFAULT gen_random_uuid(), kind text, created_by uuid, floor_number integer, status text, updated_at timestamptz, title text, description text, start_date date, end_date date, daily_start_time time, daily_end_time time, slot_minutes integer);
CREATE TABLE public.schedule_participants(session_id uuid, user_id uuid, participant_role text);
CREATE TABLE public.schedule_bookings(id uuid PRIMARY KEY, session_id uuid, resident_id uuid, ra_id uuid, completed_at timestamptz);
-- Real management policies are extracted from versioned SQL by the runner.
DROP POLICY fixture_member_access ON public.events;
DROP POLICY fixture_member_access ON storage.objects;
\i :management_definitions_file
DO $$ DECLARE t regclass; BEGIN
 FOREACH t IN ARRAY ARRAY['public.announcements'::regclass,'public.feature_flags'::regclass,'public.site_settings'::regclass,'public.schedule_sessions'::regclass,'public.schedule_participants'::regclass,'public.schedule_bookings'::regclass]
 LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %s TO authenticated',t);
 END LOOP;
END $$;
CREATE POLICY fixture_event_owner_select ON public.events FOR SELECT TO authenticated USING(created_by=auth.uid());
CREATE POLICY fixture_event_owner_delete ON public.events FOR DELETE TO authenticated USING(created_by=auth.uid());
-- Add the same active-account wrapping that exists in production.
\ir ../../supabase/migrations/20260905120000_enforce_active_accounts.sql
\ir ../../supabase/migrations/20260906090000_institutional_management_permissions.sql
\ir ../../supabase/migrations/20260906090000_institutional_management_permissions.sql
\ir ../../supabase/migrations/20260906093000_allow_delegated_announcement_images.sql
\ir ../../supabase/migrations/20260906093000_allow_delegated_announcement_images.sql

BEGIN;
INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
 ('50000000-0000-0000-0000-000000000001','permission-ra@waseda.jp','{}'),
 ('50000000-0000-0000-0000-000000000002','permission-resident@waseda.jp','{}'),
 ('50000000-0000-0000-0000-000000000003','permission-desk@wish-events.local','{"account_kind":"service_desk"}'),
 ('50000000-0000-0000-0000-000000000004','permission-staff@wish-events.local','{"account_kind":"university_staff"}');
UPDATE public.users SET role='ra',floor_number=3,room_number='01' WHERE id='50000000-0000-0000-0000-000000000001';
UPDATE public.users SET floor_number=3,room_number='02' WHERE id='50000000-0000-0000-0000-000000000002';
INSERT INTO public.feature_flags(key,state) VALUES ('availability_matching','public'),('resident_events','public');
INSERT INTO public.schedule_sessions(id,kind,created_by,status) VALUES
 ('80000000-0000-0000-0000-000000000001','general','50000000-0000-0000-0000-000000000003','open'),
 ('80000000-0000-0000-0000-000000000002','general','50000000-0000-0000-0000-000000000002','open');
CREATE FUNCTION pg_temp.assert_true(p_check boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF p_check IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_message; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.has_management_permission('events') AND public.has_management_permission('settings'), 'RA lost modules');
SELECT pg_temp.assert_true(NOT public.has_management_permission('ra_rooms') AND NOT public.has_management_permission('permissions') AND NOT public.has_management_permission(null), 'Unknown/delegation key accepted');
UPDATE public.institutional_permissions SET permissions=ARRAY['events'],updated_by=auth.uid() WHERE account_kind='service_desk';
DO $$ BEGIN
 BEGIN
  UPDATE public.institutional_permissions SET permissions=ARRAY['ra_rooms'],updated_by=auth.uid() WHERE account_kind='university_staff';
  RAISE EXCEPTION 'Unknown module accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.institutional_permissions SET permissions=ARRAY[null::text],updated_by=auth.uid() WHERE account_kind='university_staff';
  RAISE EXCEPTION 'Null module accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.has_management_permission('events') AND NOT public.has_management_permission('settings') AND NOT public.is_ra(), 'Staff scope isolation failed');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.institutional_permissions)=1, 'Other institution permissions leaked');
DO $$ DECLARE n integer; BEGIN
 UPDATE public.institutional_permissions SET permissions=ARRAY['settings'],updated_by=auth.uid() WHERE account_kind='service_desk';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Staff self-escalated'; END IF;
 UPDATE public.schedule_sessions SET status='closed' WHERE id='80000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Staff owner bypassed schedule grant'; END IF;
 BEGIN
  PERFORM public.create_resident_event('',null,null,now()+interval '1 day',null,null);
  RAISE EXCEPTION 'Empty resident event title accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'タイトルは120文字以内で入力してください' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO public.institutional_permissions(account_kind,permissions) VALUES('university_staff',ARRAY['settings']);
  RAISE EXCEPTION 'Staff inserted permissions';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.users SET role='ra' WHERE id=auth.uid();
  RAISE EXCEPTION 'Staff updated role';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.resync_room_role(3,'02');
  RAISE EXCEPTION 'Staff appointed an RA';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'permission denied' THEN RAISE; END IF; END;
 INSERT INTO public.events(id,title,event_date,created_by) VALUES('60000000-0000-0000-0000-000000000001','Delegated event',now()+interval '1 day',auth.uid());
 BEGIN
  INSERT INTO public.events(id,title,event_date,created_by) VALUES('60000000-0000-0000-0000-000000000002','Impersonated event',now()+interval '1 day','50000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'Event creator spoof allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.announcements VALUES('60000000-0000-0000-0000-000000000003',auth.uid());
  RAISE EXCEPTION 'Ungrantable announcement inserted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO storage.objects(id,name,bucket_id) VALUES('70000000-0000-0000-0000-000000000001','test.png','event-posters');
 BEGIN
  INSERT INTO storage.objects(id,name,bucket_id) VALUES('70000000-0000-0000-0000-000000000002','test.png','site-assets');
  RAISE EXCEPTION 'Event permission wrote site assets';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.save_event_survey('60000000-0000-0000-0000-000000000099','test','[]');
  RAISE EXCEPTION 'Missing event accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'イベントが見つかりません' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.set_schedule_status('60000000-0000-0000-0000-000000000099','open');
  RAISE EXCEPTION 'Events scope changed scheduling';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'RA権限が必要です' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert_true(public.can_access_event_talk('60000000-0000-0000-0000-000000000099'), 'Delegated event talk denied');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.has_management_permission('events'), 'Second institution inherited permission');
DO $$ BEGIN
 BEGIN
  PERFORM public.create_resident_event('',null,null,now()+interval '1 day',null,null);
  RAISE EXCEPTION 'Staff bypassed events grant through resident RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.create_schedule_session('general','',null,current_date,current_date,'09:00','10:00',30,3,'{}','{}');
  RAISE EXCEPTION 'Staff bypassed schedules grant through general RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.events)=0, 'Second institution saw management events');
RESET ROLE;

-- Announcement-only publication can upload new covers, but never other event assets.
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.institutional_permissions SET permissions=ARRAY['announcements'],updated_by=auth.uid() WHERE account_kind='university_staff';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 INSERT INTO storage.objects(id,name,bucket_id) VALUES('70000000-0000-0000-0000-000000000004','announcements/cover.png','event-posters');
 BEGIN
  INSERT INTO storage.objects(id,name,bucket_id) VALUES('70000000-0000-0000-0000-000000000005','events/cover.png','event-posters');
  RAISE EXCEPTION 'Announcement permission wrote another event folder';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO storage.objects(id,name,bucket_id) VALUES('70000000-0000-0000-0000-000000000006','announcements/cover.png','site-assets');
  RAISE EXCEPTION 'Announcement permission wrote another bucket';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE storage.objects SET name='announcements/replaced.png' WHERE id='70000000-0000-0000-0000-000000000004';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Announcement upload permission allowed overwrite'; END IF;
 DELETE FROM storage.objects WHERE id='70000000-0000-0000-0000-000000000004';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Announcement upload permission allowed deletion'; END IF;
END $$;
RESET ROLE;

-- Grant several modules, then verify current-session access changes without token refresh.
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.institutional_permissions SET permissions=ARRAY['schedules','notifications','residents','settings'],updated_by=auth.uid() WHERE account_kind='service_desk';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.has_management_permission('events') AND public.has_management_permission('schedules'), 'Permission revocation not immediate');
DO $$ DECLARE n integer; BEGIN
 DELETE FROM public.events WHERE id='60000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Revoked event owner retained deletion'; END IF;
 BEGIN
  INSERT INTO public.events(id,title,event_date,created_by) VALUES('60000000-0000-0000-0000-000000000004','Revoked event',now(),auth.uid());
  RAISE EXCEPTION 'Revoked event permission still wrote';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.send_ra_broadcast_notification('{}','test','/',gen_random_uuid(),'self',null);
  RAISE EXCEPTION 'Empty notification recipients accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> '送信対象は1バッチ1〜200人にしてください' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.create_schedule_session('lets_chat','',null,current_date,current_date,'09:00','10:00',30,3,'{}','{}');
  RAISE EXCEPTION 'Empty schedule title accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'タイトルは1〜80文字で入力してください' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.release_room('50000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'Staff could demote/release RA';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.release_room('50000000-0000-0000-0000-000000000002');
 PERFORM public.set_schedule_status('80000000-0000-0000-0000-000000000001','closed');
 INSERT INTO storage.objects(id,name,bucket_id) VALUES('70000000-0000-0000-0000-000000000003','test.png','site-assets');
END $$;
RESET ROLE;
SELECT pg_temp.assert_true((SELECT floor_number IS NULL FROM public.users WHERE id='50000000-0000-0000-0000-000000000002'), 'Delegated release did not work');

SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
UPDATE public.schedule_sessions SET status='closed' WHERE id='80000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT status='closed' FROM public.schedule_sessions WHERE id='80000000-0000-0000-0000-000000000002'), 'Resident owner lost scheduling rights');
SELECT pg_temp.assert_true(NOT public.has_management_permission('residents') AND (SELECT count(*) FROM public.institutional_permissions)=0, 'Resident gained management data');
RESET ROLE;
UPDATE public.users SET moved_out_at=now() WHERE id='50000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.has_management_permission('events'), 'Departed RA kept permission');
DO $$ DECLARE n integer; BEGIN
 UPDATE public.institutional_permissions SET permissions=ARRAY['events'],updated_by=auth.uid() WHERE account_kind='service_desk';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Departed RA could delegate'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.has_management_permission('settings'), 'Missing identity granted permission');
RESET ROLE;
ROLLBACK;
\echo Institutional module permission regressions passed.
