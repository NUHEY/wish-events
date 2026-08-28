-- 2階生活窓口・早稲田大学学生生活課の共有ログインを、寮生/RAとは別に識別する。
-- auth.users自体はSupabase Dashboardで作成し、このSQL適用後に末尾の関数で紐付ける。

alter table public.users
  add column if not exists account_kind text not null default 'resident';

alter table public.users
  drop constraint if exists users_account_kind_check;
alter table public.users
  add constraint users_account_kind_check
  check (account_kind in ('resident', 'service_desk', 'university_staff'));

create unique index if not exists users_one_institutional_account_per_kind_idx
  on public.users(account_kind)
  where account_kind <> 'resident';

comment on column public.users.account_kind is
  'resident=通常の寮生/RA、service_desk=2階生活窓口、university_staff=早稲田大学学生生活課。専用アカウントは通常プロフィール登録を要求しない。';

-- SQL Editorからだけ利用する初期設定用関数。Webログイン中の利用者には実行権限を与えない。
create or replace function public.configure_institutional_account(
  p_email text,
  p_account_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_display_name text;
begin
  if p_account_kind not in ('service_desk', 'university_staff') then
    raise exception 'account_kind must be service_desk or university_staff';
  end if;

  v_display_name := case p_account_kind
    when 'service_desk' then '２階生活窓口'
    else '早稲田大学学生生活課'
  end;

  update public.users
  set account_kind = p_account_kind,
      full_name = v_display_name,
      role = 'resident',
      student_id = null,
      floor_number = null,
      room_number = null,
      wish_entry_month = null,
      moved_out_at = null,
      updated_at = now()
  where lower(email) = lower(trim(p_email))
  returning id into v_user_id;

  if v_user_id is null then
    raise exception 'public.users row not found for %. Create and confirm the Auth user first.', p_email;
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.configure_institutional_account(text, text) from public;
revoke execute on function public.configure_institutional_account(text, text) from anon, authenticated;

-- Authユーザー作成後、SQL Editorで実際のメールアドレスに置き換えて各1回実行する:
-- select public.configure_institutional_account('2f-desk@example.waseda.jp', 'service_desk');
-- select public.configure_institutional_account('student-life@example.waseda.jp', 'university_staff');
