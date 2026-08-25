-- 既存のSupabaseプロジェクトに、企画メンバー機能を追加するための安全な差分。
-- Supabase Dashboard > SQL Editor で、このファイル全体を実行してください。

alter table public.events
  add column if not exists member_ids uuid[] not null default '{}',
  add column if not exists all_ra_members boolean not null default false;

alter table public.announcements
  add column if not exists member_ids uuid[] not null default '{}',
  add column if not exists all_ra_members boolean not null default false;

comment on column public.events.member_ids is '企画メンバー（RA）のpublic.users.id。all_ra_members=trueの場合は空配列にする。';
comment on column public.events.all_ra_members is 'trueの場合、RA全員が企画メンバー。';
comment on column public.announcements.member_ids is '企画メンバー（RA）のpublic.users.id。all_ra_members=trueの場合は空配列にする。';
comment on column public.announcements.all_ra_members is 'trueの場合、RA全員が企画メンバー。';
