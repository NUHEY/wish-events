-- Phase9 #111: マイページのアクセントカラーを最大5色まで選べるようにする。
-- 旧 profile_accent（単色）は互換のため残すが、以後は profile_accents（配列）を使う。
alter table public.users
  add column if not exists profile_accents text[] not null default '{}'::text[];

alter table public.users
  add constraint users_profile_accents_max5
  check (array_length(profile_accents, 1) is null or array_length(profile_accents, 1) <= 5);

-- 既存の単色設定を新しい配列カラムへ引き継ぐ
update public.users
set profile_accents = array[profile_accent]
where profile_accent is not null and profile_accents = '{}';

-- directory_profiles() の返り値に profile_accents / line_id / x_handle を追加。
-- （TypeScript側の DirectoryProfileRow 型はこれらを既に含んでいたが、実際の
--   RPC定義には無く、RA以外が他の寮生ページを見た際に静かに欠落していた。
--   ついでにこの不整合も合わせて修正する。）
drop function if exists public.directory_profiles(uuid);

create function public.directory_profiles(p_user_id uuid default null)
returns table (
  id uuid,
  full_name text,
  role text,
  floor_number integer,
  room_number text,
  faculty text,
  grade_level text,
  languages text[],
  nationalities text[],
  lived_countries text[],
  instagram_handle text,
  self_intro text,
  avatar_url text,
  line_id text,
  x_handle text,
  profile_accents text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id, u.full_name, u.role, u.floor_number, u.room_number,
    u.faculty, u.grade_level, u.languages, u.nationalities, u.lived_countries,
    u.instagram_handle, u.self_intro, u.avatar_url,
    u.line_id, u.x_handle, u.profile_accents
  from public.users u
  where (p_user_id is null or u.id = p_user_id)
    and u.moved_out_at is null
  order by u.floor_number nulls last, u.room_number nulls last, u.full_name nulls last;
$$;

comment on function public.directory_profiles(uuid) is
  '寮生ディレクトリ表示用（email/student_id/line_qr_pathは含めない）。p_user_id省略で全件、指定で1件のみ。全dormログインユーザーが実行可。';

revoke all on function public.directory_profiles(uuid) from public;
revoke execute on function public.directory_profiles(uuid) from anon;
grant execute on function public.directory_profiles(uuid) to authenticated;
