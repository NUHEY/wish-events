-- =====================================================================
-- WISH Events - Supabase スキーマ定義 (v2)
-- 対象: users / events / registrations / surveys / survey_questions /
--       survey_responses / survey_answers
-- 含む: テーブル定義, RLSポリシー, ヘルパー関数/トリガー, Storageバケット
-- 想定: Supabase SQL Editor で上から順に実行（新規プロジェクト用の完全版）
--
-- v2での変更点:
--  - room_number を floor_number(階) + room_number(号室) に分離し、
--    3〜11階すべてに対応
--  - events.target_floors で「配信対象フロア」を指定可能に
--  - RAは（作成者に関わらず）全イベント・全アンケートを編集可能に変更
--  - registrations / surveys もRA全員が閲覧・管理できるよう緩和
--  - イベント後アンケート機能を追加（外部URL or サイト内蔵）
-- =====================================================================

create extension if not exists "pgcrypto";


-- ---------------------------------------------------------------------
-- 1. users テーブル
-- ---------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text,
  student_id    text,
  floor_number  integer,           -- 3〜11
  room_number   text,              -- 号室部分のみ（階は含まない）
  role          text not null default 'resident',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint users_role_check
    check (role in ('resident', 'ra')),

  constraint users_email_domain_check
    check (email ~* '^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$'),

  constraint users_student_id_check
    check (student_id is null or student_id ~ '^[A-Za-z0-9]{8}$'),

  constraint users_floor_number_check
    check (floor_number is null or (floor_number between 3 and 11)),

  -- room_number は階を含まない号室部分のみ。
  -- 一般寮生: 2桁数字 + ユニット文字(A-D)  例: "01A"（3階なら実際の部屋は301A相当）
  -- RA        : 2桁数字のみ                例: "01"（3階なら実際の部屋は301相当）
  constraint users_room_number_check
    check (
      room_number is null
      or (role = 'resident' and room_number ~ '^[0-9]{2}[A-D]$')
      or (role = 'ra'       and room_number ~ '^[0-9]{2}$')
    )
);

comment on table public.users is 'WISH寮生ユーザー。auth.usersと1:1。';
comment on column public.users.floor_number is '居住階（3〜11）。プロフィール登録画面でセレクトボックスにより入力。';
comment on column public.users.room_number is '居住階を除いた号室部分。表示時は floor_number と結合して "301A" のように組み立てる。';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 2. auth.users 作成時に public.users のスタブ行を自動作成
--    （waseda.jpドメイン以外はここで拒否 = サインアップごと失敗させる）
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email !~* '^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$' then
    raise exception 'このメールアドレスのドメインでは登録できません（@*.waseda.jp のみ許可）';
  end if;

  insert into public.users (id, email, role)
  values (new.id, new.email, 'resident')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ---------------------------------------------------------------------
-- 3. ヘルパー関数（RLS再帰を避けるため security definer）
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql security definer stable set search_path = public
as $$ select role from public.users where id = auth.uid(); $$;

create or replace function public.is_ra()
returns boolean
language sql security definer stable set search_path = public
as $$ select coalesce(public.current_user_role() = 'ra', false); $$;

create or replace function public.current_user_floor()
returns integer
language sql security definer stable set search_path = public
as $$ select floor_number from public.users where id = auth.uid(); $$;


-- ---------------------------------------------------------------------
-- 4. events テーブル
-- ---------------------------------------------------------------------
create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  category              text not null,
  description           text,               -- Markdown本文
  poster_url            text,
  location              text,
  target_audience       text,
  event_date            timestamptz not null,
  requires_registration boolean not null default false,
  capacity              integer,

  -- 配信対象フロア。NULL または空配列 = 全フロア対象。
  -- 例: '{3,11}' なら3階・11階の寮生のみ一覧・詳細に表示される（RAには常に全件表示）。
  target_floors         integer[],

  -- イベント後アンケート
  survey_type           text not null default 'none',  -- 'none' | 'external' | 'internal'
  survey_external_url   text,                            -- Googleフォーム等のURL

  created_by            uuid not null references public.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint events_category_check
    check (category in ('RR', 'SI', '公式イベント', 'フロアイベント', 'サポーター募集', 'その他')),

  constraint events_capacity_check
    check (capacity is null or capacity > 0),

  constraint events_capacity_required_when_registration
    check (not requires_registration or capacity is not null),

  constraint events_survey_type_check
    check (survey_type in ('none', 'external', 'internal')),

  constraint events_survey_external_url_check
    check (survey_type <> 'external' or survey_external_url is not null),

  -- PostgreSQLのCHECK制約はサブクエリを使えないため、配列演算子 <@ (部分集合か)
  -- で全要素が3〜11の範囲内であることを検証する
  constraint events_target_floors_check
    check (
      target_floors is null
      or target_floors <@ array[3,4,5,6,7,8,9,10,11]
    )
);

comment on table public.events is 'WISH寮イベント。RA全員が作成・編集・削除できる。';
comment on column public.events.target_floors is 'NULL/空 = 全フロア対象。値がある場合はそのフロアの寮生のみ閲覧可（RAは常に全件閲覧可）。';

create index events_event_date_idx on public.events (event_date);
create index events_category_idx on public.events (category);
create index events_created_by_idx on public.events (created_by);
create index events_target_floors_gin_idx on public.events using gin (target_floors);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 5. registrations テーブル（事前申し込み）
-- ---------------------------------------------------------------------
create table public.registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  registered_at timestamptz not null default now(),

  constraint registrations_unique_per_user unique (event_id, user_id)
);

create index registrations_event_id_idx on public.registrations (event_id);
create index registrations_user_id_idx on public.registrations (user_id);

create or replace function public.check_event_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_capacity integer;
  v_requires boolean;
  v_current_count integer;
begin
  select capacity, requires_registration
    into v_capacity, v_requires
    from public.events
    where id = new.event_id
    for update;

  if not v_requires then
    raise exception 'このイベントは事前申し込みが不要です';
  end if;

  select count(*) into v_current_count
    from public.registrations
    where event_id = new.event_id;

  if v_capacity is not null and v_current_count >= v_capacity then
    raise exception '定員に達しているため申し込めません';
  end if;

  return new;
end;
$$;

create trigger registrations_check_capacity
  before insert on public.registrations
  for each row execute function public.check_event_capacity();


-- ---------------------------------------------------------------------
-- 6. surveys / survey_questions / survey_responses / survey_answers
--    （サイト内蔵アンケート機能。外部Googleフォームの場合はevents側のURLのみ使用）
-- ---------------------------------------------------------------------
create table public.surveys (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null unique references public.events(id) on delete cascade,
  title       text not null,
  is_active   boolean not null default true,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger surveys_set_updated_at
  before update on public.surveys
  for each row execute function public.set_updated_at();

create table public.survey_questions (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references public.surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null,   -- 'text' | 'single_choice' | 'multiple_choice' | 'rating'
  options       jsonb,           -- ['選択肢1','選択肢2', ...] choice/rating系で使用
  is_required   boolean not null default true,
  position      integer not null default 0,

  constraint survey_questions_type_check
    check (question_type in ('text', 'single_choice', 'multiple_choice', 'rating'))
);

create index survey_questions_survey_id_idx on public.survey_questions (survey_id, position);

create table public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references public.surveys(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  submitted_at  timestamptz not null default now(),

  constraint survey_responses_unique_per_user unique (survey_id, user_id)
);

create index survey_responses_survey_id_idx on public.survey_responses (survey_id);

create table public.survey_answers (
  id              uuid primary key default gen_random_uuid(),
  response_id     uuid not null references public.survey_responses(id) on delete cascade,
  question_id     uuid not null references public.survey_questions(id) on delete cascade,
  answer_text     text,          -- text/rating用
  answer_options  jsonb          -- multiple_choice用（選択された選択肢の配列）
);

create index survey_answers_response_id_idx on public.survey_answers (response_id);


-- ---------------------------------------------------------------------
-- 7. RLS 有効化
-- ---------------------------------------------------------------------
alter table public.users             enable row level security;
alter table public.events            enable row level security;
alter table public.registrations     enable row level security;
alter table public.surveys           enable row level security;
alter table public.survey_questions  enable row level security;
alter table public.survey_responses  enable row level security;
alter table public.survey_answers    enable row level security;


-- ---------------------------------------------------------------------
-- 8. users のRLSポリシー
-- ---------------------------------------------------------------------
create policy "users_select_own"
on public.users for select
using (id = auth.uid());

create policy "users_select_all_for_ra"
on public.users for select
using (public.is_ra());

create policy "users_insert_own"
on public.users for insert
with check (id = auth.uid());

create policy "users_update_own"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

-- role列は一般ユーザーが自分で書き換えられないようにする（RAへの昇格はSQLから手動）
revoke update on public.users from authenticated;
grant update (full_name, student_id, floor_number, room_number) on public.users to authenticated;
grant select, insert on public.users to authenticated;


-- ---------------------------------------------------------------------
-- 9. events のRLSポリシー
-- ---------------------------------------------------------------------
-- 閲覧: RAは常に全件。一般寮生はtarget_floorsが未指定 or 自分の階が含まれる場合のみ。
create policy "events_select"
on public.events for select
using (
  public.is_ra()
  or target_floors is null
  or array_length(target_floors, 1) is null
  or public.current_user_floor() = any (target_floors)
);

create policy "events_insert_ra"
on public.events for insert
with check (public.is_ra() and created_by = auth.uid());

-- RAは誰が作成したイベントでも編集・削除可能（管理チームとして共同運用するため）
create policy "events_update_any_ra"
on public.events for update
using (public.is_ra())
with check (public.is_ra());

create policy "events_delete_any_ra"
on public.events for delete
using (public.is_ra());


-- ---------------------------------------------------------------------
-- 10. registrations のRLSポリシー
-- ---------------------------------------------------------------------
create policy "registrations_select_own"
on public.registrations for select
using (user_id = auth.uid());

-- RAは全イベントの申込者一覧を閲覧可能
create policy "registrations_select_any_ra"
on public.registrations for select
using (public.is_ra());

create policy "registrations_insert_own"
on public.registrations for insert
with check (user_id = auth.uid());

create policy "registrations_delete_own"
on public.registrations for delete
using (user_id = auth.uid());

-- RAは定員調整等のために申込を取り消せる
create policy "registrations_delete_any_ra"
on public.registrations for delete
using (public.is_ra());


-- ---------------------------------------------------------------------
-- 11. surveys / survey_questions のRLSポリシー
-- ---------------------------------------------------------------------
-- 公開中のアンケートは回答フォーム表示のため全ログインユーザーが閲覧可能
create policy "surveys_select"
on public.surveys for select
using (is_active or public.is_ra());

create policy "surveys_insert_ra"
on public.surveys for insert
with check (public.is_ra() and created_by = auth.uid());

create policy "surveys_update_any_ra"
on public.surveys for update
using (public.is_ra())
with check (public.is_ra());

create policy "surveys_delete_any_ra"
on public.surveys for delete
using (public.is_ra());

create policy "survey_questions_select"
on public.survey_questions for select
using (
  exists (
    select 1 from public.surveys s
    where s.id = survey_questions.survey_id
      and (s.is_active or public.is_ra())
  )
);

create policy "survey_questions_manage_ra"
on public.survey_questions for all
using (public.is_ra())
with check (public.is_ra());


-- ---------------------------------------------------------------------
-- 12. survey_responses / survey_answers のRLSポリシー
-- ---------------------------------------------------------------------
create policy "survey_responses_select_own"
on public.survey_responses for select
using (user_id = auth.uid());

create policy "survey_responses_select_any_ra"
on public.survey_responses for select
using (public.is_ra());

create policy "survey_responses_insert_own"
on public.survey_responses for insert
with check (user_id = auth.uid());

create policy "survey_answers_select_own"
on public.survey_answers for select
using (
  exists (
    select 1 from public.survey_responses r
    where r.id = survey_answers.response_id
      and r.user_id = auth.uid()
  )
);

create policy "survey_answers_select_any_ra"
on public.survey_answers for select
using (public.is_ra());

create policy "survey_answers_insert_own"
on public.survey_answers for insert
with check (
  exists (
    select 1 from public.survey_responses r
    where r.id = survey_answers.response_id
      and r.user_id = auth.uid()
  )
);


-- ---------------------------------------------------------------------
-- 13. Storage バケット（ポスター画像）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

create policy "poster_public_select"
on storage.objects for select
using (bucket_id = 'event-posters');

create policy "poster_ra_insert"
on storage.objects for insert
with check (bucket_id = 'event-posters' and public.is_ra());

create policy "poster_ra_update"
on storage.objects for update
using (bucket_id = 'event-posters' and public.is_ra());

create policy "poster_ra_delete"
on storage.objects for delete
using (bucket_id = 'event-posters' and public.is_ra());


-- =====================================================================
-- RAへの昇格例:
--   update public.users set role = 'ra' where email = 'xxxx@toki.waseda.jp';
-- =====================================================================
