-- Extend existing site settings; keep all saved layout, permissions and assets intact.
alter table public.site_settings
  add column if not exists dark_accent_color text not null default '#8BB8D8'
    check (dark_accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists brand_animation_enabled boolean not null default true,
  add column if not exists brand_animation_style text not null default 'underline'
    check (brand_animation_style in ('shine', 'underline', 'lift')),
  add column if not exists brand_animation_interval_seconds integer not null default 45
    check (brand_animation_interval_seconds between 20 and 120);
