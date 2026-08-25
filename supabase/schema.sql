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
  -- 以下はRA活動用の任意プロフィール項目。すべて未回答可（NULL）。
  faculty          text,              -- 所属学部・研究科
  grade_level      text,              -- 学年区分（学部1年〜、修士、博士、交換留学生 等）
  languages        text[],            -- 話せる言語（ISO 639-1コードの配列、複数選択可）
  nationalities    text[],            -- 国籍（ISO 3166-1 alpha-2コードの配列、複数選択可）
  lived_countries  text[],            -- 居住経験のある国・地域（同上、複数選択可）
  instagram_handle text,              -- Instagramユーザーネーム（@なし）
  line_qr_path     text,              -- 非公開Storageバケット(line-qr)内のパス
  self_intro       text,              -- 自由記述の自己紹介文（寮生ディレクトリに表示、500文字以内）
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

  -- room_number は階を含まない号室部分のみ（例: "01A" や RA個室なら "07"）。
  -- ユニット文字(A-D)の有無はroleに関わらず任意とする。role自体は自己申告の
  -- room_numberでは変更できず、ra_roomsテーブルとの突き合わせによって
  -- sync_own_role()/resync_room_role()が自動的に判定する（下記参照）。
  constraint users_room_number_check
    check (
      room_number is null
      or room_number ~ '^[0-9]{2}[A-D]?$'
    ),

  constraint users_instagram_handle_check
    check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),

  constraint users_self_intro_length_check
    check (self_intro is null or char_length(self_intro) <= 500),

  -- 同じ部屋番号を複数ユーザーが同時に名乗れないようにする
  -- （自己申告のroom_numberを悪用したRAなりすまし対策も兼ねる）
  constraint users_floor_room_unique
    unique (floor_number, room_number)
);

comment on table public.users is 'WISH寮生ユーザー。auth.usersと1:1。';
comment on column public.users.floor_number is '居住階（3〜11）。プロフィール登録画面で部屋番号から自動判定される。';
comment on column public.users.room_number is '居住階を除いた号室部分。表示時は floor_number と結合して "301A" のように組み立てる。';
comment on column public.users.faculty is '所属学部・研究科（任意回答）。未回答はNULL。';
comment on column public.users.grade_level is '学年区分（学部1年〜、修士、博士、交換留学生 等。任意回答）。未回答はNULL。';
comment on column public.users.languages is '話せる言語（ISO 639-1コード配列、任意回答・複数選択可）。未回答はNULL。';
comment on column public.users.nationalities is '国籍（ISO 3166-1 alpha-2コード配列、任意回答・複数選択可。二重国籍等に対応）。未回答はNULL。';
comment on column public.users.lived_countries is '居住経験のある国・地域（同上、任意回答・複数選択可）。未回答はNULL。';
comment on column public.users.instagram_handle is 'Instagramユーザーネーム（@なし、任意回答）。未回答はNULL。';
comment on column public.users.line_qr_path is '非公開Storageバケット(line-qr)内の画像パス。本人とRAのみ閲覧可（RLSで制御）。未アップロードはNULL。';
comment on column public.users.self_intro is '自由記述の自己紹介文（任意、500文字以内）。寮生ディレクトリのプロフィールページに表示される。';

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
  title_en              text,               -- 英語タイトル（任意、未入力時は日本語表示にフォールバック）
  category              text not null,
  description           text,               -- Markdown本文
  description_en        text,               -- 英語本文（任意、Markdown、未入力時は日本語表示にフォールバック）
  poster_url            text,
  location              text,
  location_en           text,               -- 英語の開催場所（任意、未入力時は日本語表示にフォールバック）
  target_audience       text,
  target_audience_en    text,               -- 英語の対象者（任意、未入力時は日本語表示にフォールバック）
  event_date            timestamptz not null,
  requires_registration boolean not null default false,
  capacity              integer,

  -- 参加費（円）。NULLまたは0は無料イベントとして扱う。
  fee_amount            integer,
  -- 集金場所・集金方法などの案内文（任意）。
  payment_info          text,

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

  constraint events_fee_amount_check
    check (fee_amount is null or fee_amount >= 0),

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
comment on column public.events.title_en is '英語タイトル（任意）。NULLまたは空文字の場合、英語表示時も title をそのまま表示する。';
comment on column public.events.description_en is '英語本文（任意、Markdown）。NULLまたは空文字の場合、英語表示時も description をそのまま表示する。';
comment on column public.events.location_en is '英語の開催場所（任意）。NULLまたは空文字の場合、英語表示時も location をそのまま表示する。';
comment on column public.events.target_audience_en is '英語の対象者（任意）。NULLまたは空文字の場合、英語表示時も target_audience をそのまま表示する。';
comment on column public.events.fee_amount is '参加費（円）。nullまたは0は無料イベント。';
comment on column public.events.payment_info is '集金場所・集金方法などの案内文（任意）。';

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
grant update (
  full_name, student_id, floor_number, room_number,
  faculty, grade_level, languages, nationalities, lived_countries,
  instagram_handle, line_qr_path, self_intro
) on public.users to authenticated;
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


-- ---------------------------------------------------------------------
-- 13b. Storage バケット（LINE QRコード、非公開）
-- ---------------------------------------------------------------------
-- LINEのQRコードは氏名・部屋番号などと違い個人が能動的に交換するための連絡先
-- 情報であり、寮生全員には公開しない（本人とRAのみ閲覧可）。ファイルパスは
-- "{user_id}/qr.{ext}" の形式で保存し、フォルダ名(=user_id)をRLSで照合する。
insert into storage.buckets (id, name, public)
values ('line-qr', 'line-qr', false)
on conflict (id) do nothing;

create policy "line_qr_select_own_or_ra"
on storage.objects for select
using (
  bucket_id = 'line-qr'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_ra()
  )
);

create policy "line_qr_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'line-qr'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "line_qr_update_own"
on storage.objects for update
using (
  bucket_id = 'line-qr'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "line_qr_delete_own"
on storage.objects for delete
using (
  bucket_id = 'line-qr'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ---------------------------------------------------------------------
-- 14. ra_rooms: RA個室として登録されている部屋番号の一覧（学期ごとに更新）
--     この一覧に載っている floor_number + room_number でプロフィール登録
--     すると自動的にRA権限が付与される。RAが自分たちでこの一覧を管理する
--     ことで、開発者がSQLを直接叩かなくても学期ごとのRA交代に対応できる。
-- ---------------------------------------------------------------------
create table public.ra_rooms (
  id            uuid primary key default gen_random_uuid(),
  floor_number  integer not null,
  room_number   text not null,   -- RA個室はユニット文字なし。例: "07" "08" "21" "22"
  note          text,            -- 任意メモ（例: "2026秋学期"）
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),

  constraint ra_rooms_floor_check check (floor_number between 3 and 11),
  constraint ra_rooms_room_format_check check (room_number ~ '^[0-9]{2}$'),
  constraint ra_rooms_unique unique (floor_number, room_number)
);

comment on table public.ra_rooms is
  'RA個室として登録されている部屋番号の一覧。この一覧に載っている部屋番号で登録すると自動的にRA権限が付与される。RAのみ閲覧・追加・削除可能。';

alter table public.ra_rooms enable row level security;

create policy "ra_rooms_select_ra"
on public.ra_rooms for select
using (public.is_ra());

create policy "ra_rooms_insert_ra"
on public.ra_rooms for insert
with check (public.is_ra());

create policy "ra_rooms_delete_ra"
on public.ra_rooms for delete
using (public.is_ra());


-- ---------------------------------------------------------------------
-- 15. role自動同期関数
-- ---------------------------------------------------------------------

-- 自分自身の floor_number/room_number が ra_rooms に登録されているかどうかで
-- 自分自身のroleを同期する。usersテーブルのrole列はauthenticatedへの
-- update権限が無い（上記8.のgrant参照）ため、SECURITY DEFINERかつ
-- 「呼び出し本人(auth.uid())の行のみ」を対象にすることで、権限昇格の
-- 抜け道を作らずに自己同期を許可する。
create or replace function public.sync_own_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_floor integer;
  v_room  text;
  v_new_role text;
begin
  select floor_number, room_number into v_floor, v_room
    from public.users where id = auth.uid();

  if v_floor is null or v_room is null then
    return (select role from public.users where id = auth.uid());
  end if;

  if exists (
    select 1 from public.ra_rooms
    where floor_number = v_floor and room_number = v_room
  ) then
    v_new_role := 'ra';
  else
    v_new_role := 'resident';
  end if;

  update public.users set role = v_new_role where id = auth.uid();

  return v_new_role;
end;
$$;

revoke all on function public.sync_own_role() from public;
revoke execute on function public.sync_own_role() from anon;
grant execute on function public.sync_own_role() to authenticated;


-- RAがra_roomsを追加/削除した直後に呼び出し、該当部屋番号を自己申告して
-- いるユーザーがいれば即座にroleを一覧の状態へ同期する（新規追加なら
-- 昇格、削除なら降格）。is_ra()チェックを関数内でも行うことで、一般寮生が
-- 直接この関数を呼んでも他人のroleを書き換えられないようにしている。
create or replace function public.resync_room_role(p_floor integer, p_room text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ra() then
    raise exception 'permission denied';
  end if;

  if exists (
    select 1 from public.ra_rooms
    where floor_number = p_floor and room_number = p_room
  ) then
    update public.users
      set role = 'ra'
      where floor_number = p_floor and room_number = p_room and role <> 'ra';
  else
    update public.users
      set role = 'resident'
      where floor_number = p_floor and room_number = p_room and role <> 'resident';
  end if;
end;
$$;

revoke all on function public.resync_room_role(integer, text) from public;
revoke execute on function public.resync_room_role(integer, text) from anon;
grant execute on function public.resync_room_role(integer, text) to authenticated;


-- RAが個別ユーザーを手動でresidentへ戻す（ra_roomsとは無関係の個別対応用）
create or replace function public.demote_to_resident(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ra() then
    raise exception 'permission denied';
  end if;

  update public.users set role = 'resident' where id = p_user_id;
end;
$$;

revoke all on function public.demote_to_resident(uuid) from public;
revoke execute on function public.demote_to_resident(uuid) from anon;
grant execute on function public.demote_to_resident(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 16. 学期ごとの入退寮に対応する関数
--     部屋番号のユニーク制約（なりすまし対策）を維持したまま、退寮者の
--     住居情報をRAがクリアできるようにする。floor_number/room_numberを
--     NULLに戻すだけで、profileComplete判定がfalseになり、対象ユーザーは
--     次回ログイン時に自動的に /profile/setup へ再度案内される。
-- ---------------------------------------------------------------------

-- 個別の退寮処理
create or replace function public.release_room(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ra() then
    raise exception 'permission denied';
  end if;

  update public.users
    set floor_number = null,
        room_number = null,
        role = 'resident'
    where id = p_user_id;
end;
$$;

revoke all on function public.release_room(uuid) from public;
revoke execute on function public.release_room(uuid) from anon;
grant execute on function public.release_room(uuid) to authenticated;


-- 学期の変わり目用の一括リセット。誤操作対策として p_confirm = 'RESET' を要求する。
create or replace function public.reset_all_room_assignments(p_confirm text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_ra() then
    raise exception 'permission denied';
  end if;

  if p_confirm is distinct from 'RESET' then
    raise exception 'confirmation text mismatch';
  end if;

  update public.users
    set floor_number = null,
        room_number = null,
        role = 'resident'
    where floor_number is not null or room_number is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reset_all_room_assignments(text) from public;
revoke execute on function public.reset_all_room_assignments(text) from anon;
grant execute on function public.reset_all_room_assignments(text) to authenticated;


-- ---------------------------------------------------------------------
-- 16. 寮生ディレクトリ（自己紹介ページ一覧）用の関数
-- ---------------------------------------------------------------------
-- email/student_id/line_qr_pathのような機微情報は含めない
-- （line_qr_pathは本人・RAのみ /directory/[id] 側で別途 users テーブルから参照する）。
-- ビューではなく関数にしているのは、Supabaseのdatabase linterが
-- SECURITY DEFINERビューをERRORレベルで検知するため（関数ならWARNのみで、
-- このプロジェクトの他のSECURITY DEFINER関数群と同じ扱いにできる）。
-- p_user_idを省略すると全件、指定すると1件のみ返す。
create or replace function public.directory_profiles(p_user_id uuid default null)
returns table (
  id uuid,
  full_name text,
  role text,
  floor_number integer,
  room_number text,
  faculty text,
  grade_level text,
  languages text[],
  nationalities text[],
  lived_countries text[],
  instagram_handle text,
  self_intro text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id, u.full_name, u.role, u.floor_number, u.room_number,
    u.faculty, u.grade_level, u.languages, u.nationalities, u.lived_countries,
    u.instagram_handle, u.self_intro
  from public.users u
  where p_user_id is null or u.id = p_user_id
  order by u.floor_number nulls last, u.room_number nulls last, u.full_name nulls last;
$$;

comment on function public.directory_profiles(uuid) is
  '寮生ディレクトリ表示用（email/student_id/line_qr_pathは含めない）。p_user_id省略で全件、指定で1件のみ。全dormログインユーザーが実行可。';

revoke all on function public.directory_profiles(uuid) from public;
revoke execute on function public.directory_profiles(uuid) from anon;
grant execute on function public.directory_profiles(uuid) to authenticated;


-- =====================================================================
-- RAへの昇格/降格:
--   通常は /dashboard/ra-rooms （RA管理画面）からRA個室の部屋番号を
--   追加・削除することで行う（学期ごとのRA交代を想定）。
--   緊急時・個別対応用に直接SQLで昇格させたい場合は以下でも可能:
--     update public.users set role = 'ra' where email = 'xxxx@toki.waseda.jp';
-- =====================================================================
