-- イベントコメントの返信（1階層）を追加する安全な差分。
alter table public.event_comments
  add column if not exists parent_id uuid references public.event_comments(id) on delete cascade;
create index if not exists event_comments_parent_created_idx
  on public.event_comments(event_id, parent_id, created_at);

-- コメント表示専用の最小プロフィール。役割を正規化してRAバッジの判定を安定させる。
create or replace function public.event_community_profiles_v3(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text, role text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url, lower(u.role::text)
  from public.users u
  where u.id = any(profile_ids);
$$;
