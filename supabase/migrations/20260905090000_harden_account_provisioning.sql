-- Apply after 20260829130000_add_institutional_accounts.sql.
-- No current RA is automatically revoked: review the existing RA roster separately.
begin;

comment on table public.ra_rooms is
  'RA承認対象の部屋番号一覧。プロフィール登録後、既存RAが本人を確認して承認する。部屋番号の自己申告では昇格しない。RAのみ閲覧・追加・削除可能。';

revoke insert on public.users from authenticated;
grant insert (id, email, full_name, avatar_url) on public.users to authenticated;
alter policy "users_insert_own" on public.users
  with check (
    id = (select auth.uid())
    and email = (select auth.jwt() ->> 'email')
    and role = 'resident'
    and account_kind = 'resident'
  );

-- 自己申告の部屋番号はRA権限の証明にはならない。自己同期は既存RAの
-- 維持・降格だけを行い、昇格はRAによるresync_room_roleかSQL管理操作に限定する。
create or replace function public.sync_own_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.users%rowtype;
begin
  select * into v_profile from public.users where id = auth.uid() for update;
  if not found then
    return null;
  end if;

  if v_profile.role = 'ra'
    and v_profile.floor_number is not null
    and v_profile.room_number is not null
    and not exists (
      select 1 from public.ra_rooms
      where floor_number = v_profile.floor_number and room_number = v_profile.room_number
    ) then
    update public.users set role = 'resident' where id = auth.uid();
    return 'resident';
  end if;

  return v_profile.role;
end;
$$;

revoke all on function public.sync_own_role() from public;
revoke execute on function public.sync_own_role() from anon;
grant execute on function public.sync_own_role() to authenticated;


-- Only the admin-controlled Auth app metadata can create a non-Waseda
-- institutional identity. raw_user_meta_data is intentionally never trusted.
alter table public.users drop constraint if exists users_email_domain_check;
alter table public.users add constraint users_email_domain_check check (
  email ~* '^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$'
  or account_kind in ('service_desk', 'university_staff')
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := coalesce(new.raw_app_meta_data ->> 'account_kind', 'resident');
begin
  if v_kind not in ('service_desk', 'university_staff') then
    v_kind := 'resident';
  end if;
  if v_kind = 'resident' and (
    new.email is null
    or new.email !~* '^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$'
  ) then
    raise exception 'このメールアドレスのドメインでは登録できません（@*.waseda.jp のみ許可）';
  end if;

  insert into public.users (id, email, role, account_kind)
  values (new.id, new.email, 'resident', v_kind)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
commit;
