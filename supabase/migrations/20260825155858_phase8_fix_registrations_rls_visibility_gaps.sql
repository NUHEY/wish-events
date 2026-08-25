-- Phase 8: registrationsテーブルはRLSで「本人+RA」しか直接SELECTできないため、
-- 一般寮生が見るはずの「参加者アイコン一覧」「参加人数」が実際には自分の分しか
-- 返らない（＝1人しか映らない/人数が0か1にしかならない）不具合があった。
-- 個人の申込み有無自体は非公開のままにしつつ、コミュニティ機能に必要な
-- 最小限の情報だけを安全に返すSECURITY DEFINER関数を用意する。

-- 1) 1イベント分の参加者一覧（登録が新しい順）。トーク詳細のAvatarStack用。
create or replace function public.event_registration_user_ids(p_event_id uuid)
returns table (user_id uuid, registered_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select r.user_id, r.registered_at
  from public.registrations r
  where r.event_id = p_event_id
  order by r.registered_at desc;
$$;

revoke all on function public.event_registration_user_ids(uuid) from public;
revoke execute on function public.event_registration_user_ids(uuid) from anon;
grant execute on function public.event_registration_user_ids(uuid) to authenticated;

comment on function public.event_registration_user_ids(uuid) is
  'イベントトークの参加者アイコン表示用。指定イベントの参加者user_idを登録が新しい順に返す。全dormログインユーザーが実行可。';

-- 2) 複数イベント分をまとめて取得するバッチ版。トーク一覧のN+1回避用。
create or replace function public.event_registration_user_ids_batch(p_event_ids uuid[])
returns table (event_id uuid, user_id uuid, registered_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select r.event_id, r.user_id, r.registered_at
  from public.registrations r
  where r.event_id = any(p_event_ids)
  order by r.registered_at desc;
$$;

revoke all on function public.event_registration_user_ids_batch(uuid[]) from public;
revoke execute on function public.event_registration_user_ids_batch(uuid[]) from anon;
grant execute on function public.event_registration_user_ids_batch(uuid[]) to authenticated;

comment on function public.event_registration_user_ids_batch(uuid[]) is
  'event_registration_user_idsの複数イベント一括版。トーク一覧で行数分のN+1クエリを避けるために使う。全dormログインユーザーが実行可。';

-- 3) イベント詳細ページの「参加人数」表示用。誰が申込んだかは返さず件数のみ。
create or replace function public.event_registration_count(p_event_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer from public.registrations r where r.event_id = p_event_id;
$$;

revoke all on function public.event_registration_count(uuid) from public;
revoke execute on function public.event_registration_count(uuid) from anon;
grant execute on function public.event_registration_count(uuid) to authenticated;

comment on function public.event_registration_count(uuid) is
  'イベント詳細ページの参加人数表示用。誰が申込んだかは含まない。全dormログインユーザーが実行可。';
