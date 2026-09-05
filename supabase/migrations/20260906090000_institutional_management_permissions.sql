-- Module access is delegated to a shared institutional identity, never an RA role.
-- Apply after 20260905120000_enforce_active_accounts.sql.
begin;

create table if not exists public.institutional_permissions (
  account_kind text primary key check (account_kind in ('service_desk', 'university_staff')),
  permissions text[] not null default '{}',
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint institutional_permissions_allowlist check (
    array_position(permissions, null) is null and permissions <@ array[
      'events', 'announcements', 'notifications', 'schedules', 'questions', 'links',
      'badges', 'residents', 'home', 'event_options', 'features', 'settings'
    ]::text[]
  )
);
insert into public.institutional_permissions(account_kind)
values ('service_desk'), ('university_staff') on conflict (account_kind) do nothing;
alter table public.institutional_permissions enable row level security;

-- is_ra() deliberately remains unchanged. No delegated module can appoint RAs,
-- change account_kind/role, or grant permissions to itself or another account.
create or replace function public.has_management_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(p_permission = any(array[
    'events', 'announcements', 'notifications', 'schedules', 'questions', 'links',
    'badges', 'residents', 'home', 'event_options', 'features', 'settings'
  ]::text[]) and exists (
    select 1 from public.users u
    where u.id = auth.uid() and public.is_active_account() and (
      (u.account_kind = 'resident' and u.role = 'ra')
      or (u.account_kind in ('service_desk', 'university_staff') and exists (
        select 1 from public.institutional_permissions ip
        where ip.account_kind = u.account_kind and p_permission = any(ip.permissions)
      ))
    )
  ), false);
$$;
revoke all on function public.has_management_permission(text) from public, anon;
grant execute on function public.has_management_permission(text) to authenticated;

drop policy if exists institutional_permissions_read on public.institutional_permissions;
create policy institutional_permissions_read on public.institutional_permissions for select to authenticated
using (public.is_active_account() and (
  public.is_ra() or account_kind = (select u.account_kind from public.users u where u.id = auth.uid())
));
drop policy if exists institutional_permissions_update_ra on public.institutional_permissions;
create policy institutional_permissions_update_ra on public.institutional_permissions for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.account_kind = 'resident' and u.role = 'ra' and public.is_active_account()))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.account_kind = 'resident' and u.role = 'ra' and public.is_active_account()) and updated_by = auth.uid());
revoke all on public.institutional_permissions from anon, authenticated;
grant select on public.institutional_permissions to authenticated;
grant update(permissions, updated_by, updated_at) on public.institutional_permissions to authenticated;

-- Preserve every existing ownership, visibility, bucket, and restrictive active
-- account check. Replace only the RA predicate on these explicitly mapped tables.
do $migration$
declare rule record; mapped record; clause text; replacement text;
begin
  for mapped in select * from (values
    ('events','events'), ('registrations','events'), ('registration_payments','events'),
    ('registration_questions','events'), ('registration_answers','events'),
    ('surveys','events'), ('survey_questions','events'), ('survey_responses','events'), ('survey_answers','events'),
    ('event_polls','events'), ('event_comments','events'),
    ('announcements','announcements'), ('announcement_comments','announcements'),
    ('schedule_sessions','schedules'), ('schedule_participants','schedules'),
    ('schedule_availability','schedules'), ('schedule_bookings','schedules'),
    ('ra_questions','questions'), ('ra_link_hubs','links'), ('ra_link_items','links'),
    ('badges','badges'), ('home_layout_sections','home'),
    ('event_location_options','event_options'), ('event_audience_options','event_options'),
    ('feature_flags','features'), ('site_settings','settings')
  ) as mapping(table_name, permission)
  loop
    replacement := format('public.has_management_permission(%L)', mapped.permission);
    for rule in select * from pg_policies where schemaname = 'public' and tablename = mapped.table_name
      and (coalesce(qual,'') ~ '(public\.)?is_ra\(\)' or coalesce(with_check,'') ~ '(public\.)?is_ra\(\)')
    loop
      clause := '';
      if rule.qual is not null then
        clause := clause || ' using (' || regexp_replace(rule.qual, '(public\.)?is_ra\(\)', replacement, 'g') || ')';
      end if;
      if rule.with_check is not null then
        clause := clause || ' with check (' || regexp_replace(rule.with_check, '(public\.)?is_ra\(\)', replacement, 'g') || ')';
      end if;
      execute format('alter policy %I on public.%I%s', rule.policyname, rule.tablename, clause);
    end loop;
  end loop;
  -- Storage uses a shared table; never expand its unrelated avatar/DM policies.
  for rule in select * from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = any(array['poster_ra_insert','poster_ra_update','poster_ra_delete','site_assets_write_ra','site_assets_update_ra','site_assets_delete_ra'])
  loop
    replacement := format('public.has_management_permission(%L)', case when rule.policyname like 'poster_%' then 'events' else 'settings' end);
    clause := '';
    if rule.qual is not null then clause := clause || ' using (' || regexp_replace(rule.qual, '(public\.)?is_ra\(\)', replacement, 'g') || ')'; end if;
    if rule.with_check is not null then clause := clause || ' with check (' || regexp_replace(rule.with_check, '(public\.)?is_ra\(\)', replacement, 'g') || ')'; end if;
    execute format('alter policy %I on storage.objects%s', rule.policyname, clause);
  end loop;
end;
$migration$;

-- A staff identity must not keep an owner's publishing/scheduling powers after its module
-- is revoked. Residents still retain their normal ownership/participation rules.
do $migration$
declare table_name text; operation text; expression text;
begin
  foreach table_name in array array['events','schedule_sessions','schedule_participants'] loop
    expression := format('(exists (select 1 from public.users u where u.id = auth.uid() and u.account_kind = ''resident'') or public.has_management_permission(%L))', case when table_name = 'events' then 'events' else 'schedules' end);
    foreach operation in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', 'institutional_management_' || operation, table_name);
      execute format('create policy %I on public.%I as restrictive for %s to authenticated%s%s',
        'institutional_management_' || operation, table_name, operation,
        case when operation <> 'insert' then ' using (' || expression || ')' else '' end,
        case when operation <> 'delete' then ' with check (' || expression || ')' else '' end);
    end loop;
  end loop;
end;
$migration$;

-- These modules display resident records to manage participants or recipients.
-- Profile edits remain owner-only, with protected role/account-kind column grants.
drop policy if exists users_select_delegated_management on public.users;
create policy users_select_delegated_management on public.users for select to authenticated
using (public.has_management_permission('events') or public.has_management_permission('notifications')
  or public.has_management_permission('schedules') or public.has_management_permission('residents'));

-- Patch only known management RPCs, retaining signatures/defaults/OIDs/grants and
-- the previous active-account wrapper. Fail atomically if an installed body differs.
do $migration$
declare mapping record; fn record; definition text; body text; original_clause text; old_check text;
begin
  for mapping in select * from (values
    ('can_access_event_talk','events'), ('save_event_survey','events'), ('replace_registration_questions','events'), ('create_resident_event','events'),
    ('can_access_schedule_session','schedules'), ('set_schedule_status','schedules'),
    ('delete_schedule_session','schedules'), ('set_lets_chat_completed','schedules'),
    ('set_new_resident_status','residents'), ('send_ra_broadcast_notification','notifications'),
    ('create_schedule_session','schedules')
  ) as methods(name, permission)
  loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=mapping.name and p.prosecdef) then
      raise exception 'Required management RPC missing: %', mapping.name;
    end if;
    for fn in select p.oid, p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=mapping.name and p.prosecdef
    loop
      if position('-- WISH delegated management v1' in fn.prosrc) > 0 then continue; end if;
      body := fn.prosrc;
      if mapping.name = 'send_ra_broadcast_notification' then
        old_check := 'not exists (select 1 from public.users where id = auth.uid() and role = ''ra'')';
        if position(old_check in body) = 0 then raise exception 'Unexpected broadcast authorization'; end if;
        body := replace(body, old_check, 'not public.has_management_permission(''notifications'')');
      elsif mapping.name = 'create_schedule_session' then
        if position('v_role <> ''ra''' in body) = 0 then raise exception 'Unexpected schedule authorization'; end if;
        body := replace(body, 'v_role <> ''ra''', 'not public.has_management_permission(''schedules'')');
      else
        if position('public.is_ra()' in body) = 0 then raise exception 'Unexpected management authorization: %', mapping.name; end if;
        body := replace(body, 'public.is_ra()', format('public.has_management_permission(%L)', mapping.permission));
      end if;
      if mapping.name in ('create_resident_event', 'create_schedule_session') then
        old_check := case when mapping.name = 'create_resident_event'
          then 'if v_uid is null then raise exception ''ログインが必要です''; end if;'
          else 'if v_user_id is null then raise exception ''ログインが必要です''; end if;' end;
        if position(old_check in body) = 0 then raise exception 'Unexpected creator identity check: %', mapping.name; end if;
        body := replace(body, old_check, old_check || E'\n' || format(
          'if exists (select 1 from public.users u where u.id = auth.uid() and u.account_kind in (''service_desk'', ''university_staff'')) and not public.has_management_permission(%L) then raise exception ''この機能の管理権限が必要です'' using errcode = ''42501''; end if;', mapping.permission));
      end if;
      definition := pg_get_functiondef(fn.oid);
      original_clause := 'AS $function$' || fn.prosrc || '$function$';
      if position(original_clause in definition) = 0 then raise exception 'Unexpected function format: %', mapping.name; end if;
      -- Keep #variable_conflict as the first directive in existing guarded bodies.
      body := body || E'\n-- WISH delegated management v1\n';
      execute replace(definition, original_clause, 'AS $function$' || body || '$function$');
    end loop;
  end loop;
end;
$migration$;

create or replace function public.release_room(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_management_permission('residents') then
    raise exception '寮生管理の権限が必要です' using errcode = '42501';
  end if;
  -- Check under a row lock so a concurrent RA promotion cannot be demoted by staff.
  perform 1 from public.users where id = p_user_id for update;
  if not public.is_ra() and exists (
    select 1 from public.users where id = p_user_id and (role = 'ra' or account_kind <> 'resident')
  ) then raise exception 'RA・関係者アカウントの変更はRAのみが行えます' using errcode = '42501'; end if;
  update public.users set floor_number = null, room_number = null, role = 'resident', is_new_resident = false where id = p_user_id;
end;
$$;
revoke all on function public.release_room(uuid) from public, anon;
grant execute on function public.release_room(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
