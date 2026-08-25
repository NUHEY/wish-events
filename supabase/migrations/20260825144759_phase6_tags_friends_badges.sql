-- Phase 6: お知らせタグ・企画メンバー廃止、友達システム、バッジ拡充

-- ---------------------------------------------------------------------
-- 1. announcements: タグ追加、企画メンバー（member_ids/all_ra_members）廃止
--    お知らせでは企画メンバー機能は使わない方針としたため削除する。
-- ---------------------------------------------------------------------
alter table public.announcements
  add column if not exists tags text[] not null default '{}';

comment on column public.announcements.tags is
  'お知らせのタグ（例: 重要）。自由入力。「重要」は一覧で強調表示される。';

alter table public.announcements
  drop column if exists member_ids,
  drop column if exists all_ra_members;

-- ---------------------------------------------------------------------
-- 2. 友達システム（マイページのインスタ風「友達」機能）
-- ---------------------------------------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (requester_id <> addressee_id),
  constraint friend_requests_unique_pair unique (requester_id, addressee_id)
);

comment on table public.friend_requests is
  '寮生同士の「友達」申請・承認。requester→addresseeで申請し、addresseeがacceptedにすると友達成立。';

create index if not exists friend_requests_addressee_idx on public.friend_requests(addressee_id, status);
create index if not exists friend_requests_requester_idx on public.friend_requests(requester_id, status);

alter table public.friend_requests enable row level security;

create policy "friend_requests_select_own"
on public.friend_requests for select
using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create policy "friend_requests_insert_own"
on public.friend_requests for insert
with check (requester_id = (select auth.uid()));

create policy "friend_requests_update_addressee"
on public.friend_requests for update
using (addressee_id = (select auth.uid()) and status = 'pending')
with check (addressee_id = (select auth.uid()) and status = 'accepted');

create policy "friend_requests_delete_own"
on public.friend_requests for delete
using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

grant select, insert, update, delete on public.friend_requests to authenticated;
revoke select on public.friend_requests from anon;

-- ---------------------------------------------------------------------
-- 3. バッジ: criteria_typeを拡充し、バッジ数を大幅に増やす
-- ---------------------------------------------------------------------
alter table public.badges drop constraint if exists badges_criteria_type_check;
alter table public.badges add constraint badges_criteria_type_check
  check (criteria_type in ('event_count', 'survey_count', 'friend_count', 'comment_count', 'message_count', 'like_given_count'));

insert into public.badges (key, label, label_en, description, description_en, icon, color, criteria_type, criteria_value, sort_order) values
  ('super_active_plus', 'レジェンド', 'Legend', 'イベントに20回参加', 'Attended 20 events', '👑', '#B8860B', 'event_count', 20, 5),
  ('survey_master', 'アンケートマスター', 'Survey Master', 'アンケートに8回回答', 'Answered 8 surveys', '📊', '#0E8074', 'survey_count', 8, 6),
  ('first_friend', 'はじめての友達', 'First Friend', '友達が1人できた', 'Made your first friend', '🤝', '#3E7CB1', 'friend_count', 1, 7),
  ('social', '交友関係アクティブ', 'Socialite', '友達が10人以上', '10+ friends', '👥', '#3E7CB1', 'friend_count', 10, 8),
  ('super_social', '顔が広い', 'Super Social', '友達が30人以上', '30+ friends', '🌐', '#2A5A8C', 'friend_count', 30, 9),
  ('chatter', 'おしゃべり', 'Chatter', 'コメントを5回投稿', 'Posted 5 comments', '💬', '#9B5DE5', 'comment_count', 5, 10),
  ('comment_master', 'コメント職人', 'Comment Master', 'コメントを30回投稿', 'Posted 30 comments', '🗣️', '#7A3FC4', 'comment_count', 30, 11),
  ('talk_regular', 'トーク常連', 'Talk Regular', 'トークに50回投稿', 'Sent 50 talk messages', '✉️', '#2F6B4F', 'message_count', 50, 12),
  ('talk_master', 'トークマスター', 'Talk Master', 'トークに300回投稿', 'Sent 300 talk messages', '📮', '#1F4D38', 'message_count', 300, 13),
  ('like_giver', 'いいね魔', 'Like Giver', 'いいねを20回した', 'Gave 20 likes', '❤️', '#C4436B', 'like_given_count', 20, 14),
  ('super_liker', '愛あふれる人', 'Super Liker', 'いいねを100回した', 'Gave 100 likes', '💖', '#A62955', 'like_given_count', 100, 15),
  ('all_rounder', 'オールラウンダー', 'All-Rounder', 'イベント・アンケート・友達すべてに積極的', 'Active across events, surveys, and friends', '🎯', '#C79A3B', 'event_count', 8, 16)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 4. user_engagement_stats: friend_count / comment_count / message_count /
--    like_given_count を追加
-- ---------------------------------------------------------------------
-- 戻り値の列を追加するため、create or replaceではなく一度dropしてから再作成する
-- （Postgresはreturns tableの列追加をcreate or replaceだけでは許可しないため）。
drop function if exists public.user_engagement_stats(uuid);

create function public.user_engagement_stats(p_user_id uuid)
returns table (
  event_count integer,
  survey_count integer,
  friend_count integer,
  comment_count integer,
  message_count integer,
  like_given_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.registrations r where r.user_id = p_user_id) as event_count,
    (select count(*)::int from public.survey_responses sr where sr.user_id = p_user_id) as survey_count,
    (select count(*)::int from public.friend_requests fr
       where fr.status = 'accepted' and (fr.requester_id = p_user_id or fr.addressee_id = p_user_id)) as friend_count,
    (select count(*)::int from public.event_comments ec where ec.user_id = p_user_id) as comment_count,
    (select count(*)::int from public.event_messages em where em.sender_id = p_user_id) as message_count,
    (
      (select count(*)::int from public.event_likes el where el.user_id = p_user_id) +
      (select count(*)::int from public.event_comment_likes ecl where ecl.user_id = p_user_id)
    ) as like_given_count;
$$;

revoke execute on function public.user_engagement_stats(uuid) from public;
grant execute on function public.user_engagement_stats(uuid) to authenticated;
