-- RA管理画面から、イベントセルのラベル・情報量とサイト共通の操作感を
-- 調整できるようにする。既存環境にも安全に一度だけ適用できるよう、
-- すべてadd column if not existsで追加する。
alter table public.site_settings
  add column if not exists event_label_rotation_enabled boolean not null default true,
  add column if not exists event_label_duration_ms integer not null default 3600,
  add column if not exists event_label_jitter_percent integer not null default 18,
  add column if not exists event_label_shuffle_enabled boolean not null default true,
  add column if not exists event_label_limit integer not null default 0,
  add column if not exists event_label_position text not null default 'top-left',
  add column if not exists event_show_category_label boolean not null default true,
  add column if not exists event_show_new_label boolean not null default true,
  add column if not exists event_show_deadline_label boolean not null default true,
  add column if not exists event_show_fee_label boolean not null default true,
  add column if not exists event_show_free_label boolean not null default true,
  add column if not exists event_new_days integer not null default 7,
  add column if not exists event_deadline_hours integer not null default 48,
  add column if not exists event_title_lines integer not null default 2,
  add column if not exists event_card_density text not null default 'compact',
  add column if not exists navigation_lock_enabled boolean not null default true,
  add column if not exists navigation_stall_seconds integer not null default 8,
  add column if not exists mobile_touch_feedback_enabled boolean not null default true,
  add column if not exists mobile_touch_feedback_ms integer not null default 180,
  add column if not exists motion_level text not null default 'standard',
  add column if not exists cta_blur_px integer not null default 16,
  add column if not exists cta_fade_height_px integer not null default 64,
  add column if not exists cta_transition_ms integer not null default 200;

-- UI以外から更新されても極端な値で表示が壊れないよう、DB側にも範囲制約を置く。
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_display_values_check') then
    alter table public.site_settings add constraint site_settings_display_values_check check (
      event_label_duration_ms between 1800 and 12000
      and event_label_jitter_percent between 0 and 45
      and event_label_limit between 0 and 50
      and event_label_position in ('top-left', 'top-right')
      and event_new_days between 1 and 30
      and event_deadline_hours between 1 and 168
      and event_title_lines between 1 and 3
      and event_card_density in ('compact', 'comfortable')
      and navigation_stall_seconds between 3 and 30
      and mobile_touch_feedback_ms between 80 and 500
      and motion_level in ('subtle', 'standard', 'lively')
      and cta_blur_px between 0 and 32
      and cta_fade_height_px between 32 and 128
      and cta_transition_ms between 100 and 600
    );
  end if;
end $$;
