-- Run only against the disposable management fixture.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'wish_events_security_test' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
ALTER TABLE public.schedule_sessions ADD COLUMN created_at timestamptz DEFAULT now();
\ir ../../supabase/migrations/20260906153000_lock_schedule_structure.sql
\ir ../../supabase/migrations/20260906153000_lock_schedule_structure.sql
BEGIN;
INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
 ('61000000-0000-0000-0000-000000000001','schedule-ra@waseda.jp','{}'),
 ('61000000-0000-0000-0000-000000000002','schedule-resident@waseda.jp','{}');
UPDATE public.users SET role='ra',floor_number=4,room_number='01' WHERE id='61000000-0000-0000-0000-000000000001';
INSERT INTO public.feature_flags(key,state) VALUES('availability_matching','public');
INSERT INTO public.schedule_sessions(id,kind,created_by,status,title,start_date,end_date,daily_start_time,daily_end_time,slot_minutes)
VALUES('81000000-0000-0000-0000-000000000001','general','61000000-0000-0000-0000-000000000002','open','Resident schedule','2026-09-06','2026-09-07','09:00','10:00',30);
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE patch text; BEGIN
 FOREACH patch IN ARRAY ARRAY[
  'kind=''lets_chat''','kind=''urs''','created_by=''61000000-0000-0000-0000-000000000001''',
  'id=gen_random_uuid()','share_token=gen_random_uuid()','floor_number=5','start_date=''2026-09-05''','end_date=''2026-09-08''',
  'daily_start_time=''08:00''','daily_end_time=''11:00''','slot_minutes=60','created_at=now()-interval ''1 day'''
 ] LOOP
  BEGIN
   EXECUTE 'UPDATE public.schedule_sessions SET '||patch||' WHERE id=''81000000-0000-0000-0000-000000000001''';
   RAISE EXCEPTION 'Protected schedule field was mutable: %',patch;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 UPDATE public.schedule_sessions SET status='closed',title='Edited title',description='Edited description',updated_at=now() WHERE id='81000000-0000-0000-0000-000000000001';
 IF NOT EXISTS(SELECT 1 FROM public.schedule_sessions WHERE id='81000000-0000-0000-0000-000000000001' AND status='closed' AND title='Edited title' AND kind='general') THEN RAISE EXCEPTION 'Allowed owner update failed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.set_schedule_status('81000000-0000-0000-0000-000000000001','open');
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.schedule_sessions WHERE id='81000000-0000-0000-0000-000000000001' AND status='open') THEN RAISE EXCEPTION 'Management status RPC failed'; END IF; END $$;
RESET ROLE;
ROLLBACK;
\echo Schedule ownership, kind and structure regressions passed.
