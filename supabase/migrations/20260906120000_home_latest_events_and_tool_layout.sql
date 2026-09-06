-- Add the new section without changing an RA's existing order or visibility choices.
begin;

alter table public.home_layout_sections
  drop constraint if exists home_layout_sections_section_key_check;
alter table public.home_layout_sections
  add constraint home_layout_sections_section_key_check
  check (section_key in (
    'week_events', 'floor_events', 'announcements', 'featured_events',
    'popular_events', 'friends_events', 'resident_events', 'tools', 'latest_events'
  ));

insert into public.home_layout_sections (section_key, visible, position)
select 'latest_events', true, coalesce(max(position), 0) + 1
from public.home_layout_sections
on conflict (section_key) do nothing;

-- Null preserves the legacy feature_flags show_on_home/home_position configuration.
-- New utility tools do not need feature flags or external services.
alter table public.site_settings
  add column if not exists home_tool_layout jsonb default null;
alter table public.site_settings
  drop constraint if exists site_settings_home_tool_layout_check;
alter table public.site_settings
  add constraint site_settings_home_tool_layout_check
  check (home_tool_layout is null or jsonb_typeof(home_tool_layout) = 'array');

commit;
