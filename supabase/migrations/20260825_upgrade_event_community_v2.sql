-- 20260825_add_event_community.sql をすでに実行済みの環境向けアップデート。
-- 既存のメッセージ・コメント・登録データは変更しない。

-- RAバッジ表示用に、コミュニティ画面へ返す公開プロフィールにroleを追加する。
drop function if exists public.event_community_profiles(uuid[]);
create function public.event_community_profiles(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text, role text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url, u.role
  from public.users u
  where u.id = any(profile_ids);
$$;

-- イベントそのものへのいいねを追加する。
create table if not exists public.event_likes (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_likes enable row level security;

drop policy if exists "event_likes_select_authenticated" on public.event_likes;
drop policy if exists "event_likes_insert_own" on public.event_likes;
drop policy if exists "event_likes_delete_own" on public.event_likes;

create policy "event_likes_select_authenticated"
on public.event_likes for select using (auth.uid() is not null);
create policy "event_likes_insert_own"
on public.event_likes for insert with check (user_id = auth.uid());
create policy "event_likes_delete_own"
on public.event_likes for delete using (user_id = auth.uid());
