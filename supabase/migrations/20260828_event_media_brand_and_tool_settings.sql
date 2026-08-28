-- イベントの一覧サムネイルと詳細ポスターを分離し、既存イベントは現在の
-- poster_urlで補完する。UI側も相互補完するため、片方だけでも表示は欠けない。
alter table public.events add column if not exists thumbnail_url text;
update public.events set thumbnail_url = poster_url where thumbnail_url is null and poster_url is not null;

-- ブランド・ホーム・日程ツールの調整項目は、機能の置き場所に応じた管理画面から
-- RAが変更する。既存環境へ繰り返し適用しても壊れないようif not existsを使う。
alter table public.site_settings
  add column if not exists favicon_url text,
  add column if not exists apple_touch_icon_url text,
  add column if not exists app_short_name text not null default 'WISH',
  add column if not exists theme_color text not null default '#8E1728',
  add column if not exists home_tool_density text not null default 'minimal',
  add column if not exists schedule_default_start_time time not null default '09:00',
  add column if not exists schedule_default_end_time time not null default '21:00',
  add column if not exists schedule_default_slot_minutes integer not null default 30,
  add column if not exists schedule_max_days integer not null default 31;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_brand_tool_values_check') then
    alter table public.site_settings add constraint site_settings_brand_tool_values_check check (
      char_length(app_short_name) between 1 and 20
      and theme_color ~ '^#[0-9A-Fa-f]{6}$'
      and home_tool_density in ('minimal', 'compact')
      and schedule_default_start_time < schedule_default_end_time
      and schedule_default_slot_minutes in (15, 30, 60)
      and schedule_max_days between 3 and 31
    );
  end if;
end $$;
