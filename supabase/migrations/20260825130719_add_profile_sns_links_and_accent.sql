-- マイページ機能: SNSリンク(LINE ID / X)とプロフィールのアクセントカラー（デコ）を追加。
alter table public.users
  add column if not exists line_id text,
  add column if not exists x_handle text,
  add column if not exists profile_accent text;

comment on column public.users.line_id is 'LINE ID（QRコードとは別に、文字列でも共有できるように）';
comment on column public.users.x_handle is 'X（旧Twitter）のユーザー名（@なし）';
comment on column public.users.profile_accent is 'マイページの装飾用アクセントカラーキー（例: wine, sakura, sky等）';

-- directory_profiles() の返り値に新しい3項目を追加するため、戻り値の型が
-- 変わる関数は一度dropしてから作り直す必要がある。
drop function if exists public.directory_profiles(uuid);
create function public.directory_profiles(p_user_id uuid default null)
returns table (
  id uuid, full_name text, role text, floor_number integer, room_number text,
  faculty text, grade_level text, languages text[], nationalities text[], lived_countries text[],
  instagram_handle text, self_intro text, avatar_url text,
  line_id text, x_handle text, profile_accent text
)
language sql stable security definer set search_path = public
as $$
  select
    u.id, u.full_name, u.role, u.floor_number, u.room_number,
    u.faculty, u.grade_level, u.languages, u.nationalities, u.lived_countries,
    u.instagram_handle, u.self_intro, u.avatar_url,
    u.line_id, u.x_handle, u.profile_accent
  from public.users u
  where (p_user_id is null or u.id = p_user_id)
    and u.moved_out_at is null
  order by u.floor_number nulls last, u.room_number nulls last, u.full_name nulls last;
$$;

revoke execute on function public.directory_profiles(uuid) from public;
grant execute on function public.directory_profiles(uuid) to authenticated;
