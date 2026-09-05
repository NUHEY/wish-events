-- Extends the disposable account-security.sql fixture. Never run against production.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'wish_events_security_test' THEN RAISE EXCEPTION 'Disposable test database required'; END IF;
END $$;
ALTER TABLE public.users ADD COLUMN moved_out_at timestamptz;
CREATE TABLE public.events (
  id uuid PRIMARY KEY, title text NOT NULL, title_en text, category text NOT NULL DEFAULT 'social',
  event_date timestamptz NOT NULL, poster_url text, created_by uuid REFERENCES public.users(id)
);
CREATE TABLE public.registrations (
  event_id uuid REFERENCES public.events(id), user_id uuid REFERENCES public.users(id), registered_at timestamptz NOT NULL,
  PRIMARY KEY(event_id,user_id)
);
CREATE TABLE public.event_messages (
  id uuid PRIMARY KEY, event_id uuid REFERENCES public.events(id), sender_id uuid REFERENCES public.users(id),
  body text NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE public.event_chat_reads (
  event_id uuid, user_id uuid, last_read_at timestamptz, PRIMARY KEY(event_id,user_id)
);
CREATE TABLE public.event_likes (event_id uuid, user_id uuid);
CREATE TABLE public.notifications (id uuid, user_id uuid, read_at timestamptz);
CREATE SCHEMA storage;
CREATE TABLE storage.objects (id uuid PRIMARY KEY, name text, owner uuid);
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events, public.registrations, public.event_messages,
  public.event_chat_reads, public.event_likes, public.notifications, storage.objects TO authenticated;
DO $$ DECLARE t regclass; BEGIN
  FOREACH t IN ARRAY ARRAY['public.events'::regclass,'public.registrations'::regclass,'public.event_messages'::regclass,
    'public.event_chat_reads'::regclass,'public.event_likes'::regclass,'public.notifications'::regclass,'storage.objects'::regclass]
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY fixture_member_access ON %s FOR ALL TO authenticated USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;
-- Actual production function definitions, extracted by the runner.
\i :active_functions_file
\ir ../../supabase/migrations/20260905120000_enforce_active_accounts.sql
-- Idempotence must not double-wrap function bodies or duplicate policies.
\ir ../../supabase/migrations/20260905120000_enforce_active_accounts.sql

BEGIN;
INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
 ('10000000-0000-0000-0000-000000000001','active@waseda.jp','{}'),
 ('10000000-0000-0000-0000-000000000002','departed@waseda.jp','{}'),
 ('10000000-0000-0000-0000-000000000003','peer@waseda.jp','{}'),
 ('10000000-0000-0000-0000-000000000004','desk@wish-events.local','{"account_kind":"service_desk"}');
UPDATE public.users SET role='ra',floor_number=3,room_number='01' WHERE id='10000000-0000-0000-0000-000000000001';
UPDATE public.users SET moved_out_at='2026-06-01T00:00:00Z' WHERE id IN ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004');
INSERT INTO public.ra_rooms VALUES (3,'01');
INSERT INTO public.events(id,title,event_date,created_by) VALUES
 ('20000000-0000-0000-0000-000000000001','Past event','2026-05-01T00:00:00Z','10000000-0000-0000-0000-000000000003'),
 ('20000000-0000-0000-0000-000000000002','Future event','2026-07-01T00:00:00Z','10000000-0000-0000-0000-000000000003'),
 ('20000000-0000-0000-0000-000000000003','Never joined','2026-05-02T00:00:00Z','10000000-0000-0000-0000-000000000003');
INSERT INTO public.registrations VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-04-01T00:00:00Z'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','2026-04-01T00:00:00Z'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','2026-04-01T00:00:00Z');
INSERT INTO public.event_messages VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Own message','2026-05-01T01:00:00Z'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Unjoined room','2026-05-01T01:00:00Z');
INSERT INTO storage.objects VALUES ('40000000-0000-0000-0000-000000000001','private/test.png','10000000-0000-0000-0000-000000000002');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT public.is_active_account() THEN RAISE EXCEPTION 'Active RA rejected'; END IF;
 IF public.sync_own_role() <> 'ra' THEN RAISE EXCEPTION 'Nested PL/pgSQL guard changed RA synchronization'; END IF;
 IF NOT public.can_access_event_talk('20000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'SQL scalar guard changed active access'; END IF;
 IF (SELECT count(*) FROM public.event_community_profiles_v3(ARRAY['10000000-0000-0000-0000-000000000003'::uuid])) <> 1 THEN RAISE EXCEPTION 'SQL table guard changed active results'; END IF;
 IF public.has_unread_event_talk() THEN RAISE EXCEPTION 'Own or unrelated messages counted unread'; END IF;
END $$;
INSERT INTO public.event_messages VALUES
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','New peer message','2026-05-01T02:00:00Z');
DO $$ BEGIN IF NOT public.has_unread_event_talk() THEN RAISE EXCEPTION 'Peer message missing from unread indicator'; END IF; END $$;
INSERT INTO public.event_chat_reads VALUES ('20000000-0000-0000-0000-000000000001',auth.uid(),'2026-05-01T02:00:00Z');
DO $$ BEGIN IF public.has_unread_event_talk() THEN RAISE EXCEPTION 'Read message remained unread'; END IF; END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 IF public.is_active_account() THEN RAISE EXCEPTION 'Departed resident still active'; END IF;
 IF (SELECT count(*) FROM public.users) <> 1 THEN RAISE EXCEPTION 'Own profile was blocked or other profiles leaked'; END IF;
 IF (SELECT count(*) FROM public.events) <> 0 OR (SELECT count(*) FROM public.event_messages) <> 0 OR (SELECT count(*) FROM storage.objects) <> 0 THEN RAISE EXCEPTION 'Direct data or storage access leaked'; END IF;
 UPDATE public.users SET room_number='99' WHERE id=auth.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'Departed resident could edit residence'; END IF;
 BEGIN
  INSERT INTO public.event_likes VALUES ('20000000-0000-0000-0000-000000000001',auth.uid());
  RAISE EXCEPTION 'Departed resident could mutate data';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.can_access_event_talk('20000000-0000-0000-0000-000000000001') OR public.has_unread_event_talk() THEN RAISE EXCEPTION 'Departed boolean RPC leaked access'; END IF;
 BEGIN
  PERFORM * FROM public.event_community_profiles_v3(ARRAY['10000000-0000-0000-0000-000000000003'::uuid]);
  RAISE EXCEPTION 'Departed table RPC leaked data';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.sync_own_role();
  RAISE EXCEPTION 'Departed mutation RPC executed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.move_out_event_history()) <> 1 THEN RAISE EXCEPTION 'Farewell history missing or unrelated/future events leaked'; END IF;
END $$;
RESET ROLE;

-- Admin-restored residence becomes usable again; shared institutional accounts
-- do not depend on resident housing fields or a stale moved_out_at value.
UPDATE public.users SET moved_out_at=null WHERE id='10000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF NOT public.is_active_account() OR (SELECT count(*) FROM public.events)=0 THEN RAISE EXCEPTION 'Admin-restored resident stayed locked out'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT public.is_active_account() OR (SELECT count(*) FROM public.events)=0 THEN RAISE EXCEPTION 'Institutional access broke'; END IF;
 IF (SELECT count(*) FROM public.move_out_event_history())<>0 THEN RAISE EXCEPTION 'Institutional account gained personal history'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.is_active_account() OR public.has_unread_event_talk() OR (SELECT count(*) FROM public.move_out_event_history())<>0 THEN RAISE EXCEPTION 'Missing identity gained access'; END IF; END $$;
RESET ROLE;
ROLLBACK;
\echo Active-account and unread-event regressions passed.
