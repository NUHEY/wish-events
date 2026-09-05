-- Disposable fixture only. The runner creates a new cluster and this exact database.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'wish_events_security_test' THEN
    RAISE EXCEPTION 'Run only in the disposable wish_events_security_test database';
  END IF;
END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('email', current_setting('request.jwt.claim.email', true));
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}',
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id), email text NOT NULL,
  role text NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'ra')),
  account_kind text NOT NULL DEFAULT 'resident' CHECK (account_kind IN ('resident', 'service_desk', 'university_staff')),
  full_name text, avatar_url text, floor_number integer, room_number text,
  CONSTRAINT users_email_domain_check CHECK (email ~* '^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$')
);
CREATE UNIQUE INDEX institutional_kind_unique ON public.users(account_kind) WHERE account_kind <> 'resident';
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_insert_own ON public.users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY users_select_own ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, INSERT ON public.users TO authenticated;
GRANT UPDATE (floor_number, room_number) ON public.users TO authenticated;
CREATE TABLE public.ra_rooms (floor_number integer, room_number text);
CREATE FUNCTION public.is_ra() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce((SELECT role = 'ra' FROM public.users WHERE id = auth.uid()), false);
$$;
-- Test the repository's existing privileged approval function, not a reimplementation.
\i :resync_function_file
\ir ../../supabase/migrations/20260905090000_harden_account_provisioning.sql
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

BEGIN;
INSERT INTO auth.users(id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'resident@waseda.jp'),
  ('00000000-0000-0000-0000-000000000002', 'approved-ra@waseda.jp');
UPDATE public.users SET floor_number=3, room_number='01' WHERE id='00000000-0000-0000-0000-000000000001';
UPDATE public.users SET role='ra', floor_number=3, room_number='02' WHERE id='00000000-0000-0000-0000-000000000002';
INSERT INTO public.ra_rooms VALUES (3, '01'), (3, '02');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.email', 'resident@waseda.jp', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.sync_own_role() <> 'resident' THEN RAISE EXCEPTION 'Room claim self-promoted a resident'; END IF;
  BEGIN
    PERFORM public.resync_room_role(3, '01');
    RAISE EXCEPTION 'Resident could approve an RA';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'permission denied' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
SELECT public.resync_room_role(3, '01');
DO $$ BEGIN
  IF public.sync_own_role() <> 'ra' THEN RAISE EXCEPTION 'Approved RA lost existing access'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT role FROM public.users WHERE id='00000000-0000-0000-0000-000000000001') <> 'ra' THEN
    RAISE EXCEPTION 'Authorized RA approval failed';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
UPDATE public.users SET room_number='99' WHERE id=auth.uid();
DO $$ BEGIN
  IF public.sync_own_role() <> 'resident' THEN RAISE EXCEPTION 'RA leaving approved room was not demoted'; END IF;
END $$;
RESET ROLE;

-- Recreate the documented missing-profile repair path and probe protected INSERT columns.
DELETE FROM public.users WHERE id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.users(id,email,role) VALUES(auth.uid(),'resident@waseda.jp','ra');
    RAISE EXCEPTION 'Explicit privileged role insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.users(id,email,account_kind) VALUES(auth.uid(),'resident@waseda.jp','service_desk');
    RAISE EXCEPTION 'Institutional kind self-assignment succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.users(id,email) VALUES(auth.uid(),'different@waseda.jp');
    RAISE EXCEPTION 'Profile email impersonation succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO public.users(id,email,full_name) VALUES(auth.uid(),'resident@waseda.jp','Repaired resident');
END $$;
RESET ROLE;

INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000000003','desk@wish-events.local','{"account_kind":"service_desk"}'),
  ('00000000-0000-0000-0000-000000000004','staff@wish-events.local','{"account_kind":"university_staff"}');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.users WHERE account_kind IN ('service_desk','university_staff') AND role='resident') <> 2 THEN
    RAISE EXCEPTION 'Admin-controlled institutional provisioning failed';
  END IF;
  BEGIN
    INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
      ('00000000-0000-0000-0000-000000000005','spoof@attacker.example','{"account_kind":"service_desk"}');
    RAISE EXCEPTION 'User-controlled metadata bypassed domain restriction';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'このメールアドレスのドメイン%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
      ('00000000-0000-0000-0000-000000000006','unknown@attacker.example','{"account_kind":"administrator"}');
    RAISE EXCEPTION 'Unknown account kind bypassed domain restriction';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'このメールアドレスのドメイン%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
\echo Account security regressions passed.
