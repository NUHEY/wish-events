-- サイトのアクセントカラーと、状態色（エラー/成功/NEWタグ等）を色付きにするかどうかを
-- RAダッシュボードの「サイト設定」から変更できるようにするための列を追加する。
-- accent_colorは "#RRGGBB" 形式で保存し、未設定時はコード側で早稲田カラーにフォールバックする。
alter table public.site_settings
  add column if not exists accent_color text,
  add column if not exists colorful_status boolean not null default false;
