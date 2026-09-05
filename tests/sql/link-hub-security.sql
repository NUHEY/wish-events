-- Disposable fixture only. This file is run after the account/management suites.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'wish_events_security_test' THEN RAISE EXCEPTION 'Disposable database required'; END IF; END $$;
\i :link_tables_file
\ir ../../supabase/migrations/20260906090000_institutional_management_permissions.sql
\ir ../../supabase/migrations/20260906150000_atomic_link_hub_save.sql
\ir ../../supabase/migrations/20260906150000_atomic_link_hub_save.sql
BEGIN;
INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
 ('60000000-0000-0000-0000-000000000001','links-ra@waseda.jp','{}'),
 ('60000000-0000-0000-0000-000000000002','links-resident@waseda.jp','{}'),
 ('60000000-0000-0000-0000-000000000003','links-desk@wish-events.local','{"account_kind":"service_desk"}');
UPDATE public.users SET role='ra',floor_number=4,room_number='01' WHERE id='60000000-0000-0000-0000-000000000001';
CREATE FUNCTION pg_temp.assert_links(p_check boolean,p_message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF p_check IS DISTINCT FROM true THEN RAISE EXCEPTION '%',p_message; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT * FROM public.save_ra_link_hub('ra-links','Original',null,true,'[{"title":"Original link","url":"https://example.com","icon":"link","enabled":true}]');
DO $$ DECLARE invalid jsonb; BEGIN
 FOREACH invalid IN ARRAY ARRAY[
   'null'::jsonb, '{}'::jsonb, '[null]'::jsonb,
   '[{"title":"No icon","url":"https://example.com","enabled":true}]'::jsonb,
   '[{"title":"Bad protocol","url":"javascript:alert(1)","icon":"link","enabled":true}]'::jsonb,
   '[{"title":"Missing host","url":"https:///","icon":"link","enabled":true}]'::jsonb,
   '[{"title":"Space","url":"https://example.com/a b","icon":"link","enabled":true}]'::jsonb,
   '[{"title":"Bad boolean","url":"https://example.com","icon":"link","enabled":"true"}]'::jsonb,
   jsonb_build_array(jsonb_build_object('title',repeat('x',61),'url','https://example.com','icon','link','enabled',true)),
   jsonb_build_array(jsonb_build_object('title','long description','description',repeat('x',121),'url','https://example.com','icon','link','enabled',true)),
   (SELECT jsonb_agg(jsonb_build_object('title','Link','url','https://example.com','icon','link','enabled',true)) FROM generate_series(1,31))
 ] LOOP
  BEGIN
   PERFORM public.save_ra_link_hub('ra-links','Should not replace',null,true,invalid);
   RAISE EXCEPTION 'Invalid payload was accepted: %',invalid;
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
END $$;
SELECT pg_temp.assert_links((SELECT title='Original' FROM public.ra_link_hubs WHERE slug='ra-links') AND (SELECT count(*)=1 FROM public.ra_link_items),'Rejected payload changed old data');
RESET ROLE;
-- Force a failure after the original rows have been deleted. The function call
-- must roll back BOTH the metadata update and the deletion in that transaction.
CREATE FUNCTION public.test_link_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF new.title='fail-after-delete' THEN RAISE EXCEPTION 'Forced insert failure' USING errcode='23514'; END IF; RETURN new; END $$;
CREATE TRIGGER test_link_insert_failure BEFORE INSERT ON public.ra_link_items FOR EACH ROW EXECUTE FUNCTION public.test_link_insert_failure();
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.save_ra_link_hub('renamed-links','Changed metadata',null,false,'[{"title":"fail-after-delete","url":"https://example.com","icon":"link","enabled":true}]');
  RAISE EXCEPTION 'Expected insert failure';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT pg_temp.assert_links((SELECT title='Original' AND is_published FROM public.ra_link_hubs WHERE slug='ra-links') AND (SELECT count(*)=1 AND min(title)='Original link' FROM public.ra_link_items),'Partial failure lost previous links or metadata');
UPDATE public.institutional_permissions SET permissions=ARRAY['links'],updated_by=auth.uid() WHERE account_kind='service_desk';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT * FROM public.save_ra_link_hub('desk-links','Staff links',null,true,'[{"title":"Contact","url":"HTTP://example.com","icon":"contact","enabled":false}]');
DO $$ BEGIN
 BEGIN
  PERFORM public.save_ra_link_hub('ra-links','Attempt ownership collision',null,true,'[]');
  RAISE EXCEPTION 'Other owner slug was overwritten';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SELECT pg_temp.assert_links((SELECT title='Staff links' FROM public.ra_link_hubs WHERE owner_id=auth.uid()),'Conflict destroyed caller hub');
SELECT * FROM public.save_ra_link_hub('desk-links','Thirty links',null,true,(SELECT jsonb_agg(jsonb_build_object('title','Link '||i,'url','https://example.com','icon','link','enabled',true)) FROM generate_series(1,30) i));
SELECT pg_temp.assert_links((SELECT count(*)=30 AND min(position)=0 AND max(position)=29 FROM public.ra_link_items WHERE hub_id=(SELECT id FROM public.ra_link_hubs WHERE owner_id=auth.uid())),'30-link ordered replacement failed');
SELECT * FROM public.save_ra_link_hub('desk-links','Cleared deliberately',null,false,'[]');
SELECT pg_temp.assert_links((SELECT count(*)=0 FROM public.ra_link_items WHERE hub_id=(SELECT id FROM public.ra_link_hubs WHERE owner_id=auth.uid())),'Explicit empty list failed');
RESET ROLE;
UPDATE public.institutional_permissions SET permissions='{}' WHERE account_kind='service_desk';
UPDATE public.users SET moved_out_at=now() WHERE id='60000000-0000-0000-0000-000000000001';
DO $$ DECLARE caller text; BEGIN
 FOREACH caller IN ARRAY ARRAY['60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000003',''] LOOP
  PERFORM set_config('request.jwt.claim.sub',caller,true);
  BEGIN
   PERFORM public.save_ra_link_hub('forbidden','No access',null,true,'[]');
   RAISE EXCEPTION 'Revoked/inactive/resident/missing identity was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END $$;
SELECT pg_temp.assert_links(NOT has_function_privilege('anon','public.save_ra_link_hub(text,text,text,boolean,jsonb)','execute'),'Anonymous execution was granted');
ROLLBACK;
\echo Atomic link hub security and rollback regressions passed.
