-- DM画像送信・リアクション・イベント投票を追加する安全な差分。
-- 以前のマイグレーションを実行済みの環境でも、このファイルだけを一度実行してください。

-- 画像のみの投稿も許可する。本文は空でも、画像・ツール・投票のいずれかとして送信される。
alter table public.event_messages drop constraint if exists event_messages_body_check;
alter table public.event_messages drop constraint if exists event_messages_type_check;
alter table public.event_messages add constraint event_messages_body_check
  check (char_length(trim(body)) <= 2000);
alter table public.event_messages add constraint event_messages_type_check
  check (message_type in ('text', 'image', 'tool', 'poll'));

create table if not exists public.event_message_reactions (
  message_id uuid not null references public.event_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '👍', '🎉', '😂', '👀')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists event_message_reactions_message_idx on public.event_message_reactions(message_id);
alter table public.event_message_reactions enable row level security;
drop policy if exists "event_message_reactions_select_members" on public.event_message_reactions;
drop policy if exists "event_message_reactions_insert_own" on public.event_message_reactions;
drop policy if exists "event_message_reactions_delete_own" on public.event_message_reactions;
create policy "event_message_reactions_select_members" on public.event_message_reactions for select using (
  exists (select 1 from public.event_messages m where m.id = message_id and public.can_access_event_talk(m.event_id))
);
create policy "event_message_reactions_insert_own" on public.event_message_reactions for insert with check (
  user_id = auth.uid() and exists (select 1 from public.event_messages m where m.id = message_id and public.can_access_event_talk(m.event_id))
);
create policy "event_message_reactions_delete_own" on public.event_message_reactions for delete using (user_id = auth.uid());

create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  closes_at timestamptz
);
create index if not exists event_polls_event_idx on public.event_polls(event_id, created_at desc);
alter table public.event_polls enable row level security;
drop policy if exists "event_polls_select_members" on public.event_polls;
drop policy if exists "event_polls_create_ra" on public.event_polls;
create policy "event_polls_select_members" on public.event_polls for select using (public.can_access_event_talk(event_id));
create policy "event_polls_create_ra" on public.event_polls for insert with check (public.is_ra() and public.can_access_event_talk(event_id));

create table if not exists public.event_poll_votes (
  poll_id uuid not null references public.event_polls(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.event_poll_votes enable row level security;
drop policy if exists "event_poll_votes_select_members" on public.event_poll_votes;
drop policy if exists "event_poll_votes_insert_own" on public.event_poll_votes;
drop policy if exists "event_poll_votes_update_own" on public.event_poll_votes;
create policy "event_poll_votes_select_members" on public.event_poll_votes for select using (
  exists (select 1 from public.event_polls p where p.id = poll_id and public.can_access_event_talk(p.event_id))
);
create policy "event_poll_votes_insert_own" on public.event_poll_votes for insert with check (
  user_id = auth.uid() and exists (select 1 from public.event_polls p where p.id = poll_id and public.can_access_event_talk(p.event_id))
);
create policy "event_poll_votes_update_own" on public.event_poll_votes for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.event_messages add column if not exists poll_id uuid references public.event_polls(id) on delete cascade;
