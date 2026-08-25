create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.announcement_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcement_comments_announcement_created_idx
  on public.announcement_comments(announcement_id, created_at desc);

create table if not exists public.announcement_comment_likes (
  comment_id uuid not null references public.announcement_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.announcement_comments enable row level security;
alter table public.announcement_comment_likes enable row level security;

create policy "announcement_comments_select_authenticated"
on public.announcement_comments for select using (auth.uid() is not null);
create policy "announcement_comments_insert_own"
on public.announcement_comments for insert with check (user_id = auth.uid());
create policy "announcement_comments_update_own"
on public.announcement_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- event_comments と同様、投稿者本人に加えRAもモデレーション目的で削除できるようにする。
create policy "announcement_comments_delete"
on public.announcement_comments for delete using (user_id = (select auth.uid()) or public.is_ra());

create policy "announcement_comment_likes_select_authenticated"
on public.announcement_comment_likes for select using (auth.uid() is not null);
create policy "announcement_comment_likes_insert_own"
on public.announcement_comment_likes for insert with check (user_id = auth.uid());
create policy "announcement_comment_likes_delete_own"
on public.announcement_comment_likes for delete using (user_id = auth.uid());
