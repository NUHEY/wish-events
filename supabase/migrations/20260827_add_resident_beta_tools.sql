-- 寮生向けベータツール（日程調整 / Let's Chat! / URS / RA質問箱 / RAリンクページ）。
-- 既存の feature_flags を利用し、すべて初期状態は hidden（公開しない）とする。

insert into public.feature_flags (key, state) values
  ('availability_matching', 'hidden'),
  ('lets_chat_booking', 'hidden'),
  ('unit_room_sessions', 'hidden'),
  ('ra_question_box', 'hidden'),
  ('ra_link_hub', 'hidden')
on conflict (key) do nothing;

alter table public.users add column if not exists is_new_resident boolean not null default false;

create or replace function public.set_new_resident_status(p_user_id uuid, p_is_new boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_ra() then raise exception 'RA権限が必要です'; end if;
  update public.users set is_new_resident = p_is_new, updated_at = now() where id = p_user_id and floor_number is not null;
end;
$$;
revoke all on function public.set_new_resident_status(uuid, boolean) from public;
grant execute on function public.set_new_resident_status(uuid, boolean) to authenticated;

-- 退寮・学期リセット時に前学期の新寮生区分を残さない。
create or replace function public.release_room(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_ra() then raise exception 'permission denied'; end if;
  update public.users set floor_number = null, room_number = null, role = 'resident', is_new_resident = false where id = p_user_id;
end;
$$;

create or replace function public.reset_all_room_assignments(p_confirm text)
returns integer language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if not public.is_ra() then raise exception 'permission denied'; end if;
  if p_confirm is distinct from 'RESET' then raise exception 'confirmation text mismatch'; end if;
  update public.users set floor_number = null, room_number = null, role = 'resident', is_new_resident = false
  where floor_number is not null or room_number is not null or is_new_resident;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.beta_feature_enabled(p_key text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select state <> 'hidden' from public.feature_flags where key = p_key), false);
$$;
revoke all on function public.beta_feature_enabled(text) from public;
grant execute on function public.beta_feature_enabled(text) to authenticated;

create table if not exists public.schedule_sessions (
  id uuid primary key default gen_random_uuid(),
  share_token uuid not null default gen_random_uuid() unique,
  kind text not null check (kind in ('general', 'lets_chat', 'urs')),
  title text not null check (char_length(title) between 1 and 80),
  description text,
  created_by uuid not null references public.users(id) on delete cascade,
  floor_number integer,
  start_date date not null,
  end_date date not null,
  daily_start_time time not null default '09:00',
  daily_end_time time not null default '21:00',
  slot_minutes integer not null default 30 check (slot_minutes in (15, 30, 60)),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_sessions_date_check check (end_date >= start_date and end_date <= start_date + 31),
  constraint schedule_sessions_time_check check (daily_end_time > daily_start_time),
  constraint schedule_sessions_floor_check check (floor_number is null or floor_number between 1 and 20)
);

create table if not exists public.schedule_participants (
  session_id uuid not null references public.schedule_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  participant_role text not null default 'participant' check (participant_role in ('organizer', 'participant', 'ra')),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.schedule_availability (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.schedule_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint schedule_availability_time_check check (end_at > start_at),
  constraint schedule_availability_unique unique (session_id, user_id, start_at)
);

create table if not exists public.schedule_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.schedule_sessions(id) on delete cascade,
  resident_id uuid not null references public.users(id) on delete cascade,
  ra_id uuid not null references public.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists schedule_bookings_ra_slot_unique
  on public.schedule_bookings(session_id, ra_id, start_at) where status = 'confirmed';
create unique index if not exists schedule_bookings_resident_session_unique
  on public.schedule_bookings(session_id, resident_id) where status = 'confirmed';
create index if not exists schedule_sessions_creator_idx on public.schedule_sessions(created_by, created_at desc);
create index if not exists schedule_participants_user_idx on public.schedule_participants(user_id, session_id);
create index if not exists schedule_availability_session_start_idx on public.schedule_availability(session_id, start_at);
create index if not exists schedule_bookings_session_start_idx on public.schedule_bookings(session_id, start_at);

create or replace function public.schedule_feature_key(p_kind text)
returns text language sql immutable as $$
  select case p_kind
    when 'lets_chat' then 'lets_chat_booking'
    when 'urs' then 'unit_room_sessions'
    else 'availability_matching'
  end;
$$;

create or replace function public.can_access_schedule_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_sessions s
    where s.id = p_session_id
      and (
        public.is_ra()
        or (
          public.beta_feature_enabled(public.schedule_feature_key(s.kind))
          and (
            s.created_by = auth.uid()
            or exists (select 1 from public.schedule_participants p where p.session_id = s.id and p.user_id = auth.uid())
            or (s.kind = 'lets_chat' and exists (
              select 1 from public.users u where u.id = auth.uid() and u.floor_number = s.floor_number and u.is_new_resident
            ))
          )
        )
      )
  );
$$;
revoke all on function public.can_access_schedule_session(uuid) from public;
grant execute on function public.can_access_schedule_session(uuid) to authenticated;

alter table public.schedule_sessions enable row level security;
alter table public.schedule_participants enable row level security;
alter table public.schedule_availability enable row level security;
alter table public.schedule_bookings enable row level security;

drop policy if exists "schedule_sessions_select_accessible" on public.schedule_sessions;
create policy "schedule_sessions_select_accessible" on public.schedule_sessions for select to authenticated
using (public.can_access_schedule_session(id));
drop policy if exists "schedule_sessions_insert_enabled" on public.schedule_sessions;
create policy "schedule_sessions_insert_enabled" on public.schedule_sessions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (public.is_ra() or public.beta_feature_enabled(public.schedule_feature_key(kind)))
  and (kind <> 'lets_chat' or public.is_ra())
);
drop policy if exists "schedule_sessions_update_owner" on public.schedule_sessions;
create policy "schedule_sessions_update_owner" on public.schedule_sessions for update to authenticated
using (created_by = (select auth.uid()) or public.is_ra())
with check (created_by = (select auth.uid()) or public.is_ra());
drop policy if exists "schedule_sessions_delete_owner" on public.schedule_sessions;
create policy "schedule_sessions_delete_owner" on public.schedule_sessions for delete to authenticated
using (created_by = (select auth.uid()) or public.is_ra());

drop policy if exists "schedule_participants_select_accessible" on public.schedule_participants;
create policy "schedule_participants_select_accessible" on public.schedule_participants for select to authenticated
using (public.can_access_schedule_session(session_id));
drop policy if exists "schedule_participants_manage_owner" on public.schedule_participants;
create policy "schedule_participants_manage_owner" on public.schedule_participants for all to authenticated
using (exists (select 1 from public.schedule_sessions s where s.id = session_id and (s.created_by = (select auth.uid()) or public.is_ra())))
with check (exists (select 1 from public.schedule_sessions s where s.id = session_id and (s.created_by = (select auth.uid()) or public.is_ra())));

drop policy if exists "schedule_availability_select_accessible" on public.schedule_availability;
create policy "schedule_availability_select_accessible" on public.schedule_availability for select to authenticated
using (public.can_access_schedule_session(session_id));
drop policy if exists "schedule_availability_insert_own" on public.schedule_availability;
create policy "schedule_availability_insert_own" on public.schedule_availability for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_access_schedule_session(session_id));
drop policy if exists "schedule_availability_delete_own" on public.schedule_availability;
create policy "schedule_availability_delete_own" on public.schedule_availability for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "schedule_bookings_select_accessible" on public.schedule_bookings;
create policy "schedule_bookings_select_accessible" on public.schedule_bookings for select to authenticated
using (public.can_access_schedule_session(session_id) and (resident_id = (select auth.uid()) or ra_id = (select auth.uid()) or public.is_ra()));

grant select, insert, update, delete on public.schedule_sessions to authenticated;
grant select, insert, update, delete on public.schedule_participants to authenticated;
-- 追加は期間・枠長を検証するRPCだけに限定し、クライアントからの直接INSERTは許可しない。
grant select, delete on public.schedule_availability to authenticated;
grant select on public.schedule_bookings to authenticated;

create or replace function public.save_schedule_availability(p_session_id uuid, p_slots jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_slot jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer := 0;
begin
  select * into v_session from public.schedule_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.status <> 'open' or not public.can_access_schedule_session(p_session_id) then
    raise exception 'この日程調整には入力できません';
  end if;
  if v_session.kind = 'lets_chat' and not public.is_ra() then
    raise exception 'Let''s Chat!の空き時間はRAだけが登録できます';
  end if;
  if not exists (select 1 from public.schedule_participants where session_id = p_session_id and user_id = auth.uid()) then
    raise exception '参加者として登録されていません';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 1000 then
    raise exception '空き時間の形式が正しくありません';
  end if;

  delete from public.schedule_availability where session_id = p_session_id and user_id = auth.uid();
  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    v_start := (v_slot->>'startAt')::timestamptz;
    v_end := (v_slot->>'endAt')::timestamptz;
    if v_end <= v_start
      or extract(epoch from (v_end - v_start)) / 60 <> v_session.slot_minutes
      or (v_start at time zone 'Asia/Tokyo')::date < v_session.start_date
      or (v_start at time zone 'Asia/Tokyo')::date > v_session.end_date
      or (v_start at time zone 'Asia/Tokyo')::time < v_session.daily_start_time
      or (v_end at time zone 'Asia/Tokyo')::time > v_session.daily_end_time then
      raise exception '設定期間外の時間が含まれています';
    end if;
    insert into public.schedule_availability(session_id, user_id, start_at, end_at)
    values (p_session_id, auth.uid(), v_start, v_end);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.save_schedule_availability(uuid, jsonb) from public;
grant execute on function public.save_schedule_availability(uuid, jsonb) to authenticated;

create or replace function public.book_lets_chat_slot(p_session_id uuid, p_ra_id uuid, p_start_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_end timestamptz;
  v_booking_id uuid;
begin
  select * into v_session from public.schedule_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.kind <> 'lets_chat' or v_session.status <> 'open'
    or not public.beta_feature_enabled('lets_chat_booking') then
    raise exception '現在この予約は受け付けていません';
  end if;
  if not exists (select 1 from public.users where id = auth.uid() and floor_number = v_session.floor_number and is_new_resident) then
    raise exception '対象フロアの新寮生だけが予約できます';
  end if;
  if not exists (select 1 from public.schedule_participants where session_id = p_session_id and user_id = p_ra_id and participant_role = 'ra') then
    raise exception '選択したRAはこの日程に参加していません';
  end if;
  select end_at into v_end from public.schedule_availability
    where session_id = p_session_id and user_id = p_ra_id and start_at = p_start_at;
  if v_end is null then raise exception '選択した時間は予約できません'; end if;

  insert into public.schedule_bookings(session_id, resident_id, ra_id, start_at, end_at)
  values (p_session_id, auth.uid(), p_ra_id, p_start_at, v_end)
  returning id into v_booking_id;
  return v_booking_id;
exception
  when unique_violation then raise exception 'この時間は先に予約されたか、すでに予約済みです';
end;
$$;
revoke all on function public.book_lets_chat_slot(uuid, uuid, timestamptz) from public;
grant execute on function public.book_lets_chat_slot(uuid, uuid, timestamptz) to authenticated;

-- 予約者の個人情報を他の寮生へ見せず、空いている枠だけを返す。
create or replace function public.available_lets_chat_slots(p_session_id uuid)
returns table (ra_id uuid, start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select a.user_id, a.start_at, a.end_at
  from public.schedule_availability a
  join public.schedule_sessions s on s.id = a.session_id and s.kind = 'lets_chat' and s.status = 'open'
  join public.schedule_participants p on p.session_id = s.id and p.user_id = a.user_id and p.participant_role = 'ra'
  where a.session_id = p_session_id
    and public.can_access_schedule_session(p_session_id)
    and not exists (
      select 1 from public.schedule_bookings b
      where b.session_id = a.session_id and b.ra_id = a.user_id and b.start_at = a.start_at and b.status = 'confirmed'
    )
  order by a.start_at, a.user_id;
$$;
revoke all on function public.available_lets_chat_slots(uuid) from public;
grant execute on function public.available_lets_chat_slots(uuid) to authenticated;

create or replace function public.notify_lets_chat_booking()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_token uuid;
begin
  select share_token into v_token from public.schedule_sessions where id = new.session_id;
  insert into public.notifications(user_id, actor_id, type, link, preview_text, sender_label)
  values (new.ra_id, new.resident_id, 'ra_broadcast', '/tools/schedule/' || v_token::text,
    to_char(new.start_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || 'に予約が入りました', 'Let''s Chat!');
  return new;
end;
$$;
drop trigger if exists trg_notify_lets_chat_booking on public.schedule_bookings;
create trigger trg_notify_lets_chat_booking
after insert on public.schedule_bookings
for each row execute function public.notify_lets_chat_booking();

create table if not exists public.ra_questions (
  id uuid primary key default gen_random_uuid(),
  asked_by uuid not null references public.users(id) on delete cascade,
  floor_number integer,
  question text not null check (char_length(question) between 1 and 500),
  is_anonymous boolean not null default false,
  answer text check (answer is null or char_length(answer) between 1 and 1200),
  answered_by uuid references public.users(id) on delete set null,
  answered_at timestamptz,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ra_questions_public_idx on public.ra_questions(is_public, answered_at desc);
create index if not exists ra_questions_floor_idx on public.ra_questions(floor_number, created_at desc);
alter table public.ra_questions enable row level security;
drop policy if exists "ra_questions_select_allowed" on public.ra_questions;
create policy "ra_questions_select_allowed" on public.ra_questions for select to authenticated
using (public.is_ra() or asked_by = (select auth.uid()) or (is_public and answer is not null and public.beta_feature_enabled('ra_question_box')));
drop policy if exists "ra_questions_insert_own" on public.ra_questions;
create policy "ra_questions_insert_own" on public.ra_questions for insert to authenticated
with check (asked_by = (select auth.uid()) and public.beta_feature_enabled('ra_question_box'));
drop policy if exists "ra_questions_update_ra" on public.ra_questions;
create policy "ra_questions_update_ra" on public.ra_questions for update to authenticated
using (public.is_ra()) with check (public.is_ra());
drop policy if exists "ra_questions_delete_allowed" on public.ra_questions;
create policy "ra_questions_delete_allowed" on public.ra_questions for delete to authenticated
using (public.is_ra() or (asked_by = (select auth.uid()) and answer is null));
grant select, insert, update, delete on public.ra_questions to authenticated;

create or replace function public.notify_ra_question_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, actor_id, type, link, preview_text, sender_label)
    select u.id, new.asked_by, 'ra_broadcast', '/dashboard/questions', left(new.question, 140), 'RA質問箱'
    from public.users u
    where u.role = 'ra' and u.id <> new.asked_by;
  elsif tg_op = 'UPDATE' and new.answer is not null and new.answer is distinct from old.answer then
    insert into public.notifications(user_id, actor_id, type, link, preview_text, sender_label)
    values (new.asked_by, new.answered_by, 'ra_broadcast', '/questions', left(new.answer, 140), 'RA質問箱');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_ra_question_activity on public.ra_questions;
create trigger trg_notify_ra_question_activity
after insert or update on public.ra_questions
for each row execute function public.notify_ra_question_activity();

create table if not exists public.ra_link_hubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  title text not null check (char_length(title) between 1 and 60),
  bio text check (bio is null or char_length(bio) <= 240),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ra_link_items (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.ra_link_hubs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  url text not null check (char_length(url) between 8 and 1000),
  description text check (description is null or char_length(description) <= 120),
  icon text not null default 'link' check (icon in ('link', 'form', 'instagram', 'document', 'calendar', 'contact')),
  position integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ra_link_items_hub_position_idx on public.ra_link_items(hub_id, position);
alter table public.ra_link_hubs enable row level security;
alter table public.ra_link_items enable row level security;
drop policy if exists "ra_link_hubs_select_allowed" on public.ra_link_hubs;
create policy "ra_link_hubs_select_allowed" on public.ra_link_hubs for select to authenticated
using (owner_id = (select auth.uid()) or public.is_ra() or (is_published and public.beta_feature_enabled('ra_link_hub')));
drop policy if exists "ra_link_hubs_manage_owner" on public.ra_link_hubs;
create policy "ra_link_hubs_manage_owner" on public.ra_link_hubs for all to authenticated
using (owner_id = (select auth.uid()) and public.is_ra())
with check (owner_id = (select auth.uid()) and public.is_ra());
drop policy if exists "ra_link_items_select_allowed" on public.ra_link_items;
create policy "ra_link_items_select_allowed" on public.ra_link_items for select to authenticated
using (exists (select 1 from public.ra_link_hubs h where h.id = hub_id and (h.owner_id = (select auth.uid()) or public.is_ra() or (h.is_published and public.beta_feature_enabled('ra_link_hub')))));
drop policy if exists "ra_link_items_manage_owner" on public.ra_link_items;
create policy "ra_link_items_manage_owner" on public.ra_link_items for all to authenticated
using (exists (select 1 from public.ra_link_hubs h where h.id = hub_id and h.owner_id = (select auth.uid()) and public.is_ra()))
with check (exists (select 1 from public.ra_link_hubs h where h.id = hub_id and h.owner_id = (select auth.uid()) and public.is_ra()));
grant select, insert, update, delete on public.ra_link_hubs to authenticated;
grant select, insert, update, delete on public.ra_link_items to authenticated;
