-- イベント参加・トーク・コメント・いいねを追加する差分。
-- Supabase Dashboard > SQL Editor でこのファイル全体を実行してください。

alter table public.events
  alter column requires_registration set default true;

update public.events set requires_registration = true where requires_registration = false;

alter table public.events
  drop constraint if exists events_capacity_required_when_registration;

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists event_messages_event_created_idx on public.event_messages(event_id, created_at);

create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_comments_event_created_idx on public.event_comments(event_id, created_at desc);

create table if not exists public.event_comment_likes (
  comment_id uuid not null references public.event_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.event_messages enable row level security;
alter table public.event_comments enable row level security;
alter table public.event_comment_likes enable row level security;

create or replace function public.can_access_event_talk(target_event_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$
  select public.is_ra() or exists (
    select 1 from public.registrations
    where event_id = target_event_id and user_id = auth.uid()
  );
$$;

-- メッセージ・コメント画面に必要な公開プロフィールだけを返す（email等は出さない）。
create or replace function public.event_community_profiles(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url
  from public.users u
  where u.id = any(profile_ids);
$$;

create policy "event_messages_select_members"
on public.event_messages for select using (public.can_access_event_talk(event_id));
create policy "event_messages_insert_members"
on public.event_messages for insert with check (
  sender_id = auth.uid() and public.can_access_event_talk(event_id)
);

create policy "event_comments_select_authenticated"
on public.event_comments for select using (auth.uid() is not null);
create policy "event_comments_insert_own"
on public.event_comments for insert with check (user_id = auth.uid());
create policy "event_comments_update_own"
on public.event_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "event_comments_delete_own"
on public.event_comments for delete using (user_id = auth.uid());

create policy "event_comment_likes_select_authenticated"
on public.event_comment_likes for select using (auth.uid() is not null);
create policy "event_comment_likes_insert_own"
on public.event_comment_likes for insert with check (user_id = auth.uid());
create policy "event_comment_likes_delete_own"
on public.event_comment_likes for delete using (user_id = auth.uid());
