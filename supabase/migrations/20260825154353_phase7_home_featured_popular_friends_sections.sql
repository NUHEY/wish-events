-- Phase 7: ホームに「注目のイベント」「人気のイベント」「友達が参加するイベント」の
-- 3セクションを追加するための土台。

-- 1) home_layout_sections に新しい3つのsection_keyを追加し、デフォルトで表示する行を作成する。
alter table public.home_layout_sections drop constraint home_layout_sections_section_key_check;
alter table public.home_layout_sections add constraint home_layout_sections_section_key_check
  check (section_key in (
    'week_events', 'floor_events', 'announcements',
    'featured_events', 'popular_events', 'friends_events'
  ));

insert into public.home_layout_sections (section_key, visible, position) values
  ('featured_events', true, 4),
  ('popular_events', true, 5),
  ('friends_events', true, 6)
on conflict (section_key) do nothing;

-- 2) 「人気のイベント」用: registrationsテーブルへの直接アクセスはRLSで自分の分しか
-- 見えないため、集計だけを安全に返すSECURITY DEFINER関数を用意する（誰が申込んだかは返さない）。
create or replace function public.popular_upcoming_events(p_limit integer default 6)
returns table (event_id uuid, registration_count integer)
language sql
security definer
stable
set search_path = public
as $$
  select r.event_id, count(*)::integer as registration_count
  from public.registrations r
  join public.events e on e.id = r.event_id
  where e.event_date >= now()
  group by r.event_id
  order by count(*) desc
  limit p_limit;
$$;

revoke all on function public.popular_upcoming_events(integer) from public;
revoke execute on function public.popular_upcoming_events(integer) from anon;
grant execute on function public.popular_upcoming_events(integer) to authenticated;

comment on function public.popular_upcoming_events(integer) is
  'ホーム画面「人気のイベント」用。開催予定イベントを申込数の多い順に返す（誰が申込んだかは含まない）。全dormログインユーザーが実行可。';

-- 3) 「友達が参加するイベント」用: 承認済み(accepted)の友達が申込んでいる開催予定イベントを、
-- friend_requestsを介して安全に解決するSECURITY DEFINER関数。
-- 呼び出したユーザー本人と「友達」関係にある相手の申込みだけを返すため、
-- 無関係な他ユーザーの申込み状況は一切漏れない。
create or replace function public.friends_attending_events()
returns table (event_id uuid, friend_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select distinct r.event_id, r.user_id as friend_id
  from public.registrations r
  join public.events e on e.id = r.event_id
  join public.friend_requests fr
    on fr.status = 'accepted'
    and (
      (fr.requester_id = auth.uid() and fr.addressee_id = r.user_id)
      or (fr.addressee_id = auth.uid() and fr.requester_id = r.user_id)
    )
  where e.event_date >= now();
$$;

revoke all on function public.friends_attending_events() from public;
revoke execute on function public.friends_attending_events() from anon;
grant execute on function public.friends_attending_events() to authenticated;

comment on function public.friends_attending_events() is
  'ホーム画面「友達が参加するイベント」用。呼び出したユーザーと承認済みの友達関係にある相手が申込んでいる開催予定イベントをevent_id/friend_idのペアで返す。全dormログインユーザーが実行可。';
