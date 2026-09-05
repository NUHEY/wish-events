-- Apply after 20260905090000_harden_account_provisioning.sql.
-- Existing authorization rules remain in force; this adds an active-account requirement.
begin;

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (u.moved_out_at is null or u.account_kind in ('service_desk', 'university_staff'))
  );
$$;
revoke all on function public.is_active_account() from public;
grant execute on function public.is_active_account() to authenticated;

-- These low-level predicates must return false/null, rather than raising, because
-- they also participate in the policy that lets a departed resident read their own row.
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select u.role from public.users u where u.id = auth.uid() and public.is_active_account(); $$;
create or replace function public.is_ra()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() = 'ra', false); $$;
create or replace function public.current_user_floor()
returns integer language sql stable security definer set search_path = public
as $$ select u.floor_number from public.users u where u.id = auth.uid() and public.is_active_account(); $$;

-- Restrictive policies are ANDed with every existing permissive policy. They never
-- grant extra access. Optional feature tables are covered when installed.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'events', 'registrations', 'surveys', 'survey_questions', 'survey_responses', 'survey_answers',
    'ra_rooms', 'registration_questions', 'registration_answers', 'announcements',
    'home_layout_sections', 'event_location_options', 'event_audience_options',
    'event_messages', 'event_comments', 'event_comment_likes', 'event_likes',
    'registration_payments', 'event_chat_reads', 'event_message_reactions', 'event_polls',
    'event_poll_votes', 'badges', 'friend_requests', 'direct_messages', 'direct_message_reads',
    'announcement_comments', 'announcement_comment_likes', 'notifications', 'feature_flags',
    'schedule_sessions', 'schedule_participants', 'schedule_availability', 'schedule_bookings',
    'ra_questions', 'ra_link_hubs', 'ra_link_items', 'wish_questions', 'wish_answers',
    'floor_messages', 'floor_message_reads'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists active_account_required on public.%I', table_name);
      execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using ((select public.is_active_account())) with check ((select public.is_active_account()))', table_name);
    end if;
  end loop;
end;
$$;

-- A departed resident can still load their own identity for /move-out. Ordinary
-- profile edits cannot restore residence or bypass the departed status.
drop policy if exists active_account_users_read on public.users;
create policy active_account_users_read on public.users as restrictive for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_account()));
drop policy if exists active_account_users_update on public.users;
create policy active_account_users_update on public.users as restrictive for update to authenticated
  using ((select public.is_active_account())) with check ((select public.is_active_account()));
drop policy if exists active_account_users_delete on public.users;
create policy active_account_users_delete on public.users as restrictive for delete to authenticated
  using ((select public.is_active_account()));

-- Storage authorization (including issuing fresh signed URLs) must not depend on
-- the web middleware. Public image URLs remain public by the bucket's existing design.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists active_account_required on storage.objects';
    execute 'create policy active_account_required on storage.objects as restrictive for all to authenticated using ((select public.is_active_account())) with check ((select public.is_active_account()))';
  end if;
end $$;

-- SECURITY DEFINER RPCs bypass table RLS. Guard the installed definitions in place,
-- retaining their OIDs, signatures, defaults, grants, owner and business logic. An
-- explicit allowlist avoids changing trigger functions, extension routines or Auth.
-- Nest existing PL/pgSQL blocks intact; single-query SQL bodies become equivalent
-- RETURN / RETURN QUERY blocks. use_column retains SQL's column name resolution.
do $migration$
declare
  fn record;
  definition text;
  guarded_body text;
  query_body text;
  original_clause text;
  denial text;
begin
  for fn in
    select p.oid, p.proname, p.prosrc, p.proretset, p.prorettype, l.lanname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.prosecdef and p.proname = any(array[
      'sync_own_role', 'resync_room_role', 'demote_to_resident', 'release_room', 'reset_all_room_assignments',
      'directory_profiles', 'directory_profiles_v2', 'self_move_out', 'can_access_event_talk', 'event_community_profiles',
      'event_community_profiles_v2', 'event_community_profiles_v3', 'user_engagement_stats',
      'popular_upcoming_events', 'friends_attending_events', 'event_registration_user_ids',
      'event_registration_user_ids_batch', 'event_registration_count', 'friend_dm_threads',
      'can_access_dm_media', 'has_unread_notifications', 'send_ra_broadcast_notification',
      'has_unread_talks', 'has_unread_direct_messages', 'event_talk_threads', 'profile_past_events',
      'set_new_resident_status', 'beta_feature_enabled', 'can_access_schedule_session',
      'save_schedule_availability', 'book_lets_chat_slot', 'available_lets_chat_slots',
      'is_current_new_resident', 'replace_registration_questions', 'register_for_event',
      'create_resident_event', 'create_schedule_session', 'set_schedule_status',
      'delete_schedule_session', 'set_lets_chat_completed', 'save_event_survey',
      'submit_survey_response', 'accept_wish_answer', 'floor_group_thread', 'floor_group_profiles'
    ])
  loop
    if position('-- WISH active-account guard v1' in fn.prosrc) > 0 then continue; end if;
    if fn.lanname not in ('sql', 'plpgsql') then
      raise exception 'Unsupported language for active-account guard: %', fn.proname;
    end if;
    definition := pg_get_functiondef(fn.oid);
    original_clause := 'AS $function$' || fn.prosrc || '$function$';
    if position(original_clause in definition) = 0 then
      raise exception 'Unexpected function definition format: %', fn.proname;
    end if;
    -- Boolean policy predicates fail closed without making an otherwise valid
    -- own-profile read raise during PostgreSQL's policy expression evaluation.
    denial := case when fn.prorettype = 'boolean'::regtype and not fn.proretset
      then 'return false;'
      else 'raise exception ''Active residence is required'' using errcode = ''42501'';'
    end;
    guarded_body := E'\n#variable_conflict use_column\n-- WISH active-account guard v1\nbegin\n'
      || 'if not public.is_active_account() then ' || denial || E' end if;\n';
    if fn.lanname = 'sql' then
      query_body := regexp_replace(btrim(fn.prosrc), ';[[:space:]]*$', '');
      if query_body !~* '^[[:space:]]*(select|with)[[:space:]]' then
        raise exception 'Expected a single SQL query for active-account guard: %', fn.proname;
      end if;
      guarded_body := guarded_body || case when fn.proretset
        then 'return query ' || query_body || E';\n'
        else 'return (' || query_body || E'\n);\n' end;
      definition := replace(definition, 'LANGUAGE sql', 'LANGUAGE plpgsql');
    else
      guarded_body := guarded_body || fn.prosrc || E'\n';
    end if;
    guarded_body := guarded_body || 'end;';
    execute replace(definition, original_clause, 'AS $function$' || guarded_body || '$function$');
  end loop;
end;
$migration$;

-- Only the caller's historical event summary survives move-out. There is no
-- user-id parameter, no participant/contact/chat data, and no future event access.
create or replace function public.move_out_event_history()
returns table (id uuid, title text, title_en text, category text, event_date timestamptz, poster_url text)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, e.title_en, e.category, e.event_date, e.poster_url
  from public.users u
  join public.registrations r on r.user_id = u.id
  join public.events e on e.id = r.event_id
  where u.id = auth.uid() and u.account_kind = 'resident'
    and (u.moved_out_at is null or (e.event_date <= u.moved_out_at and r.registered_at <= u.moved_out_at))
  order by r.registered_at;
$$;
revoke all on function public.move_out_event_history() from public;
grant execute on function public.move_out_event_history() to authenticated;

create or replace function public.has_unread_event_talk()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_active_account() and exists (
    select 1
    from public.registrations r
    join public.event_messages m on m.event_id = r.event_id
    left join public.event_chat_reads cr on cr.event_id = r.event_id and cr.user_id = auth.uid()
    where r.user_id = auth.uid()
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
  );
$$;
revoke all on function public.has_unread_event_talk() from public;
grant execute on function public.has_unread_event_talk() to authenticated;

notify pgrst, 'reload schema';
commit;
