-- サイト全体のメタ設定（favicon自体はコード側で固定表示するため対象外。
-- ここではURLで共有した際に表示されるOGP用のタイトル・説明・画像をRAが
-- ダッシュボードから変更できるようにするための設定を1行だけ持つ）。
create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  og_title text,
  og_description text,
  og_image_url text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;
alter table public.site_settings enable row level security;

-- OGP用メタタグは未ログインのリンクプレビューBot（LINE/Slack等）からも
-- 読まれるため、selectはanonにも許可する。
drop policy if exists "site_settings_select_all" on public.site_settings;
create policy "site_settings_select_all" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "site_settings_update_ra" on public.site_settings;
create policy "site_settings_update_ra" on public.site_settings for update to authenticated
using (public.is_ra()) with check (public.is_ra() and updated_by = (select auth.uid()));

revoke all on public.site_settings from anon;
grant select on public.site_settings to anon;
grant select, update on public.site_settings to authenticated;

-- RAがOGP画像をアップロードするための公開バケット（サムネイル用途のみで機微情報は置かない）。
insert into storage.buckets (id, name, public) values ('site-assets', 'site-assets', true) on conflict (id) do nothing;

drop policy if exists "site_assets_select_public" on storage.objects;
create policy "site_assets_select_public" on storage.objects for select using (bucket_id = 'site-assets');
drop policy if exists "site_assets_write_ra" on storage.objects;
create policy "site_assets_write_ra" on storage.objects for insert to authenticated with check (bucket_id = 'site-assets' and public.is_ra());
drop policy if exists "site_assets_update_ra" on storage.objects;
create policy "site_assets_update_ra" on storage.objects for update to authenticated using (bucket_id = 'site-assets' and public.is_ra());
drop policy if exists "site_assets_delete_ra" on storage.objects;
create policy "site_assets_delete_ra" on storage.objects for delete to authenticated using (bucket_id = 'site-assets' and public.is_ra());
