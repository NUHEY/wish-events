-- ゲーム要素（バッジ）機能:
-- 1) badges: RAが管理するバッジ定義（アイコン・色・付与条件）。
-- 2) user_engagement_stats(): 他ユーザーの参加数/アンケート回答数を安全に
--    取得するSECURITY DEFINER関数。マイページ（ディレクトリのプロフィール
--    詳細）でバッジ達成状況やアイコンの金色リングを、本人以外にも表示できる
--    ようにするために必要（registrations/survey_responsesは本人+RAしか
--    直接SELECTできないため）。件数のみを返し、詳細な行は返さない。
create table public.badges (
  id               uuid primary key default gen_random_uuid(),
  key              text not null unique,
  label            text not null,
  label_en         text,
  description      text,
  description_en   text,
  icon             text not null default '🏅',
  color            text not null default '#C79A3B',
  criteria_type    text not null check (criteria_type in ('event_count', 'survey_count')),
  criteria_value   integer not null check (criteria_value > 0),
  sort_order       integer not null default 0,
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.badges is
  'マイページのバッジ（ゲーム要素）定義。RAが管理画面(/dashboard/badges)から追加・編集・削除する。付与自体はDBに保存せず、user_engagement_statsの件数と比較して都度計算する。';

alter table public.badges enable row level security;

create policy "badges_select_all"
on public.badges for select
using (true);

create policy "badges_insert_ra"
on public.badges for insert
with check (public.is_ra());

create policy "badges_update_ra"
on public.badges for update
using (public.is_ra())
with check (public.is_ra());

create policy "badges_delete_ra"
on public.badges for delete
using (public.is_ra());

create trigger set_badges_updated_at
before update on public.badges
for each row execute function public.set_updated_at();

-- 初期バッジを何件か用意しておく（RAは管理画面から自由に編集・追加できる）。
insert into public.badges (key, label, label_en, description, description_en, icon, color, criteria_type, criteria_value, sort_order) values
  ('first_step', 'はじめの一歩', 'First Step', 'イベントに1回参加', 'Attended 1 event', '🌱', '#2F6B4F', 'event_count', 1, 1),
  ('regular', '常連さん', 'Regular', 'イベントに5回参加', 'Attended 5 events', '🎉', '#C79A3B', 'event_count', 5, 2),
  ('super_active', 'スーパー参加者', 'Super Active', 'イベントに10回参加', 'Attended 10 events', '⭐', '#7A2140', 'event_count', 10, 3),
  ('voice', '声を届ける人', 'Voice Heard', 'アンケートに3回回答', 'Answered 3 surveys', '📣', '#0E8074', 'survey_count', 3, 4);

create function public.user_engagement_stats(p_user_id uuid)
returns table (event_count integer, survey_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.registrations r where r.user_id = p_user_id) as event_count,
    (select count(*)::int from public.survey_responses sr where sr.user_id = p_user_id) as survey_count;
$$;

revoke execute on function public.user_engagement_stats(uuid) from public;
grant execute on function public.user_engagement_stats(uuid) to authenticated;
