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
  avatar_url       text,              -- 公開Storageバケット(avatars)内画像の公開URL。プロフィールアイコン。未設定はNULL
  moved_out_at     timestamptz,       -- 寮生本人による退寮設定日時。NULL=在寮中（self_move_out()経由のみ設定可）
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
comment on column public.users.moved_out_at is '寮生本人が退寮設定を行った日時。NULL=在寮中。設定されるとfloor_number/room_numberはNULL、roleはresidentにリセットされる。';

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

  -- 公開時間・申込開始時間（どちらもNULL=制限なし・即時）
  publish_at                    timestamptz,
  registration_opens_at         timestamptz,
  registration_requires_answers boolean not null default false,

  -- 配信対象フロア。NULL または空配列 = 全フロア対象。
  -- 例: '{3,11}' なら3階・11階の寮生のみ一覧・詳細に表示される（RAには常に全件表示）。
  target_floors         integer[],

  -- イベント後アンケート
  survey_type           text not null default 'none',  -- 'none' | 'external' | 'internal'
  survey_external_url   text,                            -- Googleフォーム等のURL

  -- 詳細設定（すべて任意）
  registration_closes_at timestamptz,  -- NULL=締切なし。過ぎるとRA以外は新規申込不可。
  location_url            text,        -- 会場の地図等へのリンク
  contact_info             text,        -- 問い合わせ先（担当RA名やLINE等）
  notes                     text,        -- その他の備考
  is_pinned                boolean not null default false,  -- ホームで優先的に上位表示
  member_ids               uuid[] not null default '{}', -- 企画メンバー（RA）のusers.id
  all_ra_members           boolean not null default false, -- RA全員が企画メンバー

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
comment on column public.events.publish_at is 'NULL=即公開。将来の日時を指定すると、その時刻まで一般寮生には一覧・詳細とも非表示（RAは常に閲覧可）。';
comment on column public.events.registration_opens_at is 'NULL=定員に達していなければ即申込可。将来の日時を指定すると、その時刻まで申込ボタンが無効になる。';
comment on column public.events.registration_requires_answers is 'trueの場合、申込前にregistration_questionsへの回答が必須になる。';
comment on column public.events.registration_closes_at is 'NULL=締切なし。指定した日時を過ぎるとRA以外は新規申込不可になる。';
comment on column public.events.location_url is '会場の地図等へのリンク（任意）。';
comment on column public.events.contact_info is '問い合わせ先（任意、担当RA名やLINE等）。';
comment on column public.events.notes is 'その他の備考（任意、詳細ページに表示）。';
comment on column public.events.is_pinned is 'trueの場合、ホームの「今週のイベント」等で優先的に上位表示される。';

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
  v_registration_opens_at timestamptz;
  v_registration_closes_at timestamptz;
  v_current_count integer;
begin
  select capacity, requires_registration, registration_opens_at, registration_closes_at
    into v_capacity, v_requires, v_registration_opens_at, v_registration_closes_at
    from public.events
    where id = new.event_id
    for update;

  if not v_requires then
    raise exception 'このイベントは事前申し込みが不要です';
  end if;

  -- registration_opens_at（申込受付開始日時）を過ぎるまではRA以外は申込不可。
  -- クライアント側のボタンdisabled表示はUXでしかないため、Server Action直叩きでの
  -- 回避を防ぐ目的でここ（DBトリガー）でも強制する。
  if v_registration_opens_at is not null
     and v_registration_opens_at > now()
     and not public.is_ra() then
    raise exception '申込受付開始前です';
  end if;

  -- registration_closes_at（申込締切日時）を過ぎた後はRA以外は新規申込不可。
  if v_registration_closes_at is not null
     and v_registration_closes_at < now()
     and not public.is_ra() then
    raise exception '申込は締め切りました';
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
  instagram_handle, line_qr_path, self_intro, avatar_url
) on public.users to authenticated;
grant select, insert on public.users to authenticated;


-- ---------------------------------------------------------------------
-- 9. events のRLSポリシー
-- ---------------------------------------------------------------------
-- 閲覧: RAは常に全件。一般寮生はpublish_atを過ぎておりtarget_floorsが
-- 未指定 or 自分の階が含まれる場合のみ。
-- 自分がregistrationsを持つイベントは、フロア条件やpublish_atに関わらず常に
-- 閲覧可にする（退寮済みユーザーはfloor_numberがNULLになるため、これが無いと
-- target_floors指定イベントが退寮画面の参加履歴から消えてしまう）。
create policy "events_select"
on public.events for select
using (
  public.is_ra()
  or (
    (publish_at is null or publish_at <= now())
    and (
      target_floors is null
      or array_length(target_floors, 1) is null
      or public.current_user_floor() = any (target_floors)
    )
  )
  or exists (
    select 1 from public.registrations r
    where r.event_id = events.id and r.user_id = auth.uid()
  )
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
-- 13c. Storage バケット（プロフィールアイコン、公開・本人のみ書き込み）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_select_public"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_update_own"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_delete_own"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);


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
  self_intro text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id, u.full_name, u.role, u.floor_number, u.room_number,
    u.faculty, u.grade_level, u.languages, u.nationalities, u.lived_countries,
    u.instagram_handle, u.self_intro, u.avatar_url
  from public.users u
  where (p_user_id is null or u.id = p_user_id)
    and u.moved_out_at is null
  order by u.floor_number nulls last, u.room_number nulls last, u.full_name nulls last;
$$;


-- ---------------------------------------------------------------------
-- 17. registration_questions / registration_answers（申込前の事前質問）
-- ---------------------------------------------------------------------
create table public.registration_questions (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  question_text  text not null,
  question_type  text not null default 'text',
  options        text[],
  is_required    boolean not null default true,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),

  constraint registration_questions_type_check
    check (question_type in ('text', 'single_choice', 'multiple_choice'))
);

comment on table public.registration_questions is 'イベント申込前に回答してもらう質問（アレルギー等）。registration_requires_answers=trueのイベントのみ使用。';

create index registration_questions_event_idx on public.registration_questions (event_id, position);

alter table public.registration_questions enable row level security;

create policy "registration_questions_select"
on public.registration_questions for select
using (
  public.is_ra()
  or exists (select 1 from public.events e where e.id = event_id)
);

create policy "registration_questions_insert_ra"
on public.registration_questions for insert
with check (public.is_ra());

create policy "registration_questions_update_ra"
on public.registration_questions for update
using (public.is_ra())
with check (public.is_ra());

create policy "registration_questions_delete_ra"
on public.registration_questions for delete
using (public.is_ra());

grant select, insert, update, delete on public.registration_questions to authenticated;
revoke select on public.registration_questions from anon;

create table public.registration_answers (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  question_id      uuid not null references public.registration_questions(id) on delete cascade,
  answer_text      text,
  answer_options   text[],
  created_at       timestamptz not null default now(),

  constraint registration_answers_unique unique (registration_id, question_id)
);

comment on table public.registration_answers is '申込者が事前質問に回答した内容。';

alter table public.registration_answers enable row level security;

create policy "registration_answers_select"
on public.registration_answers for select
using (
  public.is_ra()
  or exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = auth.uid()
  )
);

create policy "registration_answers_insert_own"
on public.registration_answers for insert
with check (
  exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.user_id = auth.uid()
  )
);

grant select, insert on public.registration_answers to authenticated;
revoke select, insert on public.registration_answers from anon;


-- ---------------------------------------------------------------------
-- 18. announcements（Homeに表示するイベント以外のお知らせ）
-- ---------------------------------------------------------------------
create table public.announcements (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  category_label   text,
  body             text not null,
  cover_image_url  text,
  pinned           boolean not null default false,
  member_ids       uuid[] not null default '{}',
  all_ra_members   boolean not null default false,
  created_by       uuid not null references public.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.announcements is 'Homeに表示するイベント以外のお知らせ（生活窓口・週間SI/RR案内・アパレル案内など）。RAが自由に投稿できる。';

create index announcements_pinned_created_idx on public.announcements (pinned desc, created_at desc);

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

create policy "announcements_select_all"
on public.announcements for select
using (true);

create policy "announcements_insert_ra"
on public.announcements for insert
with check (public.is_ra() and created_by = auth.uid());

create policy "announcements_update_any_ra"
on public.announcements for update
using (public.is_ra())
with check (public.is_ra());

create policy "announcements_delete_any_ra"
on public.announcements for delete
using (public.is_ra());

grant select, insert, update, delete on public.announcements to authenticated;
revoke select on public.announcements from anon;


-- ---------------------------------------------------------------------
-- 19. self_move_out（寮生本人による退寮設定）
-- ---------------------------------------------------------------------
create or replace function public.self_move_out()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
    set floor_number = null,
        room_number = null,
        role = 'resident',
        moved_out_at = now()
    where id = auth.uid()
      and moved_out_at is null;
end;
$$;

revoke all on function public.self_move_out() from public;
revoke execute on function public.self_move_out() from anon;
grant execute on function public.self_move_out() to authenticated;

comment on function public.directory_profiles(uuid) is
  '寮生ディレクトリ表示用（email/student_id/line_qr_pathは含めない）。p_user_id省略で全件、指定で1件のみ。全dormログインユーザーが実行可。';

revoke all on function public.directory_profiles(uuid) from public;
revoke execute on function public.directory_profiles(uuid) from anon;
grant execute on function public.directory_profiles(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 20. home_layout_sections テーブル（ホーム画面のRA向けレイアウト設定）
-- ---------------------------------------------------------------------
create table public.home_layout_sections (
  id          uuid primary key default gen_random_uuid(),
  section_key text not null unique,   -- 'week_events' | 'floor_events' | 'announcements'
  visible     boolean not null default true,
  position    integer not null,
  accent      text,                  -- プリセットのアクセントカラーキー（null=デフォルト）
  title_ja    text,                  -- セクションタイトルの上書き（nullでデフォルト文言）
  title_en    text,
  updated_at  timestamptz not null default now(),

  constraint home_layout_sections_section_key_check
    check (section_key in ('week_events', 'floor_events', 'announcements'))
);

comment on table public.home_layout_sections is 'ホーム画面（ポータル）のセクション表示設定。RAが表示/非表示・並び順・配色・タイトルをカスタマイズできる。';

create trigger home_layout_sections_set_updated_at
  before update on public.home_layout_sections
  for each row execute function public.set_updated_at();

insert into public.home_layout_sections (section_key, visible, position) values
  ('week_events', true, 1),
  ('floor_events', true, 2),
  ('announcements', true, 3)
on conflict (section_key) do nothing;

alter table public.home_layout_sections enable row level security;

-- 閲覧: 全ログインユーザー（ホーム画面のレンダリングに必要）
create policy "home_layout_sections_select_all"
on public.home_layout_sections for select
using (true);

-- 編集: RAのみ
create policy "home_layout_sections_update_ra"
on public.home_layout_sections for update
using (public.is_ra())
with check (public.is_ra());

grant select on public.home_layout_sections to authenticated;
grant update (visible, position, accent, title_ja, title_en) on public.home_layout_sections to authenticated;
revoke select on public.home_layout_sections from anon;


-- ---------------------------------------------------------------------
-- 21. event_location_options / event_audience_options
--     イベント作成フォームの「開催場所」「対象者」欄で、RAが選択肢を追加・削除
--     できるようにするためのマスタテーブル。events側のlocation/location_en/
--     target_audience/target_audience_enは引き続き自由記述のtext列のままとし
--     （既存データとの互換性を保つため）、フォーム側でdatalistの候補として
--     これらの選択肢を提示する運用とする。
-- ---------------------------------------------------------------------
create table public.event_location_options (
  id          uuid primary key default gen_random_uuid(),
  label_ja    text not null,
  label_en    text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.event_location_options is 'イベント作成フォームの「開催場所」欄でRAが管理する選択肢一覧（自由記述と併用可）。';

create index event_location_options_position_idx on public.event_location_options (position);

alter table public.event_location_options enable row level security;

create policy "event_location_options_select_all"
on public.event_location_options for select
using (true);

create policy "event_location_options_insert_ra"
on public.event_location_options for insert
with check (public.is_ra());

create policy "event_location_options_update_ra"
on public.event_location_options for update
using (public.is_ra())
with check (public.is_ra());

create policy "event_location_options_delete_ra"
on public.event_location_options for delete
using (public.is_ra());

grant select, insert, update, delete on public.event_location_options to authenticated;
revoke select on public.event_location_options from anon;

create table public.event_audience_options (
  id          uuid primary key default gen_random_uuid(),
  label_ja    text not null,
  label_en    text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.event_audience_options is 'イベント作成フォームの「対象者」欄でRAが管理する選択肢一覧（自由記述と併用可）。';

create index event_audience_options_position_idx on public.event_audience_options (position);

alter table public.event_audience_options enable row level security;

create policy "event_audience_options_select_all"
on public.event_audience_options for select
using (true);

create policy "event_audience_options_insert_ra"
on public.event_audience_options for insert
with check (public.is_ra());

create policy "event_audience_options_update_ra"
on public.event_audience_options for update
using (public.is_ra())
with check (public.is_ra());

create policy "event_audience_options_delete_ra"
on public.event_audience_options for delete
using (public.is_ra());

grant select, insert, update, delete on public.event_audience_options to authenticated;
revoke select on public.event_audience_options from anon;

-- 初期データ：WISHでよく使われる開催場所・対象者の例をいくつか投入しておく
insert into public.event_location_options (label_ja, label_en, position) values
  ('1階ラウンジ', '1F Lounge', 0),
  ('多目的室', 'Multipurpose Room', 1),
  ('キッチンスタジオ', 'Kitchen Studio', 2),
  ('中庭', 'Courtyard', 3);

insert into public.event_audience_options (label_ja, label_en, position) values
  ('全寮生', 'All residents', 0),
  ('新入寮生', 'New residents', 1),
  ('日本人学生', 'Japanese students', 2),
  ('留学生', 'International students', 3);


-- =====================================================================
-- ここから下（22〜28）は、2026年8月に追加されたイベントコミュニティ機能
-- （トーク・コメント・いいね・投票・集金・企画メンバー）のマイグレーション
-- 履歴をそのまま記録したもの。個別の supabase/migrations/*.sql ファイルと
-- 内容は同じで、ドキュメントとして1ファイルに集約するためにここへ転記した。
-- 新規プロジェクトにこのファイルを上から実行する場合、event_community_profiles
-- 関数はv1→v2→v3と再定義されるため、最終的にはv3のみが残る（想定どおり）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 22. events / announcements の企画メンバー（organizing team）
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 23. イベントコミュニティ（トーク・コメント・いいね）の初期版
-- ---------------------------------------------------------------------
alter table public.events
  alter column requires_registration set default true;

update public.events set requires_registration = true where requires_registration = false;

alter table public.events
  drop constraint if exists events_capacity_required_when_registration;

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists event_messages_event_created_idx on public.event_messages(event_id, created_at);
alter publication supabase_realtime add table public.event_messages;

create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_comments_event_created_idx on public.event_comments(event_id, created_at desc);

create table if not exists public.event_comment_likes (
  comment_id uuid not null references public.event_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.event_likes (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_messages enable row level security;
alter table public.event_comments enable row level security;
alter table public.event_comment_likes enable row level security;
alter table public.event_likes enable row level security;

create or replace function public.can_access_event_talk(target_event_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$
  select public.is_ra() or exists (
    select 1 from public.registrations
    where event_id = target_event_id and user_id = auth.uid()
  );
$$;

-- メッセージ・コメント画面に必要な公開プロフィールだけを返す（email等は出さない）。
-- 注: この v2 関数は後続の 26 でv3に置き換わり、コード側からは参照されなくなる
-- （27の最適化マイグレーションでは無印版のみdropしており、v2は歴史的経緯として残る）。
create or replace function public.event_community_profiles_v2(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text, role text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url, u.role
  from public.users u
  where u.id = any(profile_ids);
$$;

create policy "event_messages_select_members"
on public.event_messages for select using (public.can_access_event_talk(event_id));
create policy "event_messages_insert_members"
on public.event_messages for insert with check (
  sender_id = auth.uid() and public.can_access_event_talk(event_id)
);

create policy "event_comments_select_authenticated"
on public.event_comments for select using (auth.uid() is not null);
create policy "event_comments_insert_own"
on public.event_comments for insert with check (user_id = auth.uid());
create policy "event_comments_update_own"
on public.event_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "event_comments_delete_own"
on public.event_comments for delete using (user_id = auth.uid());
-- 注: このポリシーは29でevent_comments_deleteに置き換わり、RAも削除できるようになる。

create policy "event_comment_likes_select_authenticated"
on public.event_comment_likes for select using (auth.uid() is not null);
create policy "event_comment_likes_insert_own"
on public.event_comment_likes for insert with check (user_id = auth.uid());
create policy "event_comment_likes_delete_own"
on public.event_comment_likes for delete using (user_id = auth.uid());

create policy "event_likes_select_authenticated"
on public.event_likes for select using (auth.uid() is not null);
create policy "event_likes_insert_own"
on public.event_likes for insert with check (user_id = auth.uid());
create policy "event_likes_delete_own"
on public.event_likes for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 24. イベントコミュニティ v2 拡張（RAバッジ用のroleを返す関数の差し替え等）
-- ---------------------------------------------------------------------
drop function if exists public.event_community_profiles(uuid[]);
create function public.event_community_profiles(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text, role text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url, u.role
  from public.users u
  where u.id = any(profile_ids);
$$;

drop policy if exists "event_likes_select_authenticated" on public.event_likes;
drop policy if exists "event_likes_insert_own" on public.event_likes;
drop policy if exists "event_likes_delete_own" on public.event_likes;

create policy "event_likes_select_authenticated"
on public.event_likes for select using (auth.uid() is not null);
create policy "event_likes_insert_own"
on public.event_likes for insert with check (user_id = auth.uid());
create policy "event_likes_delete_own"
on public.event_likes for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 25. 手動集金管理（registration_payments）・トーク画像・未読通知
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists payment_due_at timestamptz,
  add column if not exists payment_destination text;

-- 既存の申込情報とは分離し、RAが集金確認だけを管理する。
create table if not exists public.registration_payments (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  confirmed_at timestamptz,
  confirmed_by uuid references public.users(id),
  note text,
  updated_at timestamptz not null default now()
);
alter table public.registration_payments enable row level security;
-- 注: select/manage_ra(all)ポリシーは28で分割され、現在は
--   registration_payments_select / _insert_ra / _update_ra / _delete_ra
--   の4本構成になっている（multiple_permissive_policies対策）。

alter table public.event_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path text,
  add column if not exists action_url text,
  add column if not exists action_label text;
alter table public.event_messages drop constraint if exists event_messages_type_check;
alter table public.event_messages add constraint event_messages_type_check check (message_type in ('text', 'image', 'tool'));

create table if not exists public.event_chat_reads (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_chat_reads enable row level security;
create policy "event_chat_reads_select_own" on public.event_chat_reads for select using (user_id = auth.uid());
create policy "event_chat_reads_insert_own" on public.event_chat_reads for insert with check (user_id = auth.uid());
create policy "event_chat_reads_update_own" on public.event_chat_reads for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- トーク画像は非公開。参加者・RAだけが読み書きできる。
insert into storage.buckets (id, name, public) values ('event-chat-media', 'event-chat-media', false) on conflict (id) do nothing;
create policy "chat_media_select_members" on storage.objects for select using (
  bucket_id = 'event-chat-media' and public.can_access_event_talk((storage.foldername(name))[1]::uuid)
);
create policy "chat_media_insert_members" on storage.objects for insert with check (
  bucket_id = 'event-chat-media' and public.can_access_event_talk((storage.foldername(name))[1]::uuid)
);

-- ---------------------------------------------------------------------
-- 26. トーク体験 v3（画像投稿の緩和・リアクション・投票）
-- ---------------------------------------------------------------------
alter table public.event_messages drop constraint if exists event_messages_body_check;
alter table public.event_messages drop constraint if exists event_messages_type_check;
alter table public.event_messages add constraint event_messages_body_check
  check (char_length(trim(body)) <= 2000);
alter table public.event_messages add constraint event_messages_type_check
  check (message_type in ('text', 'image', 'tool', 'poll'));

create table if not exists public.event_message_reactions (
  message_id uuid not null references public.event_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '👍', '🎉', '😂', '👀')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists event_message_reactions_message_idx on public.event_message_reactions(message_id);
alter table public.event_message_reactions enable row level security;
create policy "event_message_reactions_select_members" on public.event_message_reactions for select using (
  exists (select 1 from public.event_messages m where m.id = message_id and public.can_access_event_talk(m.event_id))
);
-- 注: insert/deleteポリシーは27で (select auth.uid()) を使うよう更新済み。
create policy "event_message_reactions_insert_own" on public.event_message_reactions for insert with check (
  user_id = (select auth.uid()) and exists (select 1 from public.event_messages m where m.id = message_id and public.can_access_event_talk(m.event_id))
);
create policy "event_message_reactions_delete_own" on public.event_message_reactions for delete using (user_id = (select auth.uid()));

create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  closes_at timestamptz
);
create index if not exists event_polls_event_idx on public.event_polls(event_id, created_at desc);
alter table public.event_polls enable row level security;
create policy "event_polls_select_members" on public.event_polls for select using (public.can_access_event_talk(event_id));
create policy "event_polls_create_ra" on public.event_polls for insert with check (public.is_ra() and public.can_access_event_talk(event_id));

create table if not exists public.event_poll_votes (
  poll_id uuid not null references public.event_polls(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.event_poll_votes enable row level security;
create policy "event_poll_votes_select_members" on public.event_poll_votes for select using (
  exists (select 1 from public.event_polls p where p.id = poll_id and public.can_access_event_talk(p.event_id))
);
create policy "event_poll_votes_insert_own" on public.event_poll_votes for insert with check (
  user_id = (select auth.uid()) and exists (select 1 from public.event_polls p where p.id = poll_id and public.can_access_event_talk(p.event_id))
);
create policy "event_poll_votes_update_own" on public.event_poll_votes for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.event_messages add column if not exists poll_id uuid references public.event_polls(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 27. イベントコメントの返信（1階層）
-- ---------------------------------------------------------------------
alter table public.event_comments
  add column if not exists parent_id uuid references public.event_comments(id) on delete cascade;
create index if not exists event_comments_parent_created_idx
  on public.event_comments(event_id, parent_id, created_at);

-- コメント表示専用の最小プロフィール。役割を正規化してRAバッジの判定を安定させる。
-- これがコード側（src/app 配下）から実際に呼ばれている最新版（v3）。
create or replace function public.event_community_profiles_v3(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text, role text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url, lower(u.role::text)
  from public.users u
  where u.id = any(profile_ids);
$$;

-- ---------------------------------------------------------------------
-- 28. パフォーマンス最適化・セキュリティ強化
--   （supabase/migrations/20260825092405_optimize_rls_policies_and_indexes.sql
--    〜 20260825092502_split_manage_ra_all_policies_to_fix_multiple_permissive.sql
--    の3本。Supabaseのperformance/security advisorの警告をすべて解消した）
-- ---------------------------------------------------------------------
-- 概要（詳細は上記3ファイル、またはSupabaseダッシュボードのマイグレーション
-- 履歴を参照。ここでは全文を再掲せず要点のみ記載する）:
--
--  1) auth_rls_initplan対策: 本ファイル中の auth.uid() を使うRLSポリシー
--     （users / events / registrations / surveys / survey_responses /
--     survey_answers / event_comments / event_comment_likes / announcements /
--     registration_answers / event_messages / event_likes / event_chat_reads /
--     event_message_reactions / event_poll_votes / registration_payments）
--     をすべて (select auth.uid()) でラップし、行ごとの関数再評価を防止。
--     （このファイル内の該当ポリシーは、上のとおりすでに (select auth.uid())
--      表記に更新済み。）
--
--  2) multiple_permissive_policies対策: registrations(select/delete) /
--     survey_answers(select) / survey_responses(select) / users(select) /
--     survey_questions(select) / registration_payments(select) を、
--     「RAは全件」「本人のみ」の2ポリシーから単一の結合ポリシーに統合。
--     さらに registration_payments_manage_ra / survey_questions_manage_ra
--     という FOR ALL ポリシーは、SELECTにも暗黙的に適用され重複扱いになる
--     ため、INSERT/UPDATE/DELETE専用の3ポリシーに分割した。
--
--  3) 外部キー17件に不足していたインデックスを追加
--     （announcements.created_by, event_chat_reads.user_id,
--      event_comment_likes.user_id, event_comments.parent_id/user_id,
--      event_likes.user_id, event_message_reactions.user_id,
--      event_messages.poll_id/sender_id, event_poll_votes.user_id,
--      event_polls.created_by, ra_rooms.created_by,
--      registration_answers.question_id,
--      registration_payments.confirmed_by, survey_answers.question_id,
--      survey_responses.user_id, surveys.created_by）。
--
--  4) セキュリティ: can_access_event_talk / event_community_profiles_v3 が
--     PostgreSQLのデフォルト仕様でPUBLIC（＝未ログインのanonも含む）から
--     実行可能になっていたのを是正。REVOKE ... FROM anon だけでは不十分で、
--     REVOKE ... FROM public のあとに GRANT ... TO authenticated が必要
--     だった点に注意（Supabaseのセキュリティadvisorで検出）。
--     あわせて、コードから参照されなくなった無印版 event_community_profiles
--     関数を削除した。

-- ---------------------------------------------------------------------
-- 29. コメント削除機能: RAもモデレーション目的で削除できるようにする
--   （supabase/migrations/20260825095622_allow_ra_delete_any_event_comment.sql）
-- ---------------------------------------------------------------------
drop policy if exists "event_comments_delete_own" on public.event_comments;
create policy "event_comments_delete" on public.event_comments
for delete using (user_id = (select auth.uid()) or public.is_ra());

-- =====================================================================
-- RAへの昇格/降格:
--   通常は /dashboard/ra-rooms （RA管理画面）からRA個室の部屋番号を
--   追加・削除することで行う（学期ごとのRA交代を想定）。
--   緊急時・個別対応用に直接SQLで昇格させたい場合は以下でも可能:
--     update public.users set role = 'ra' where email = 'xxxx@toki.waseda.jp';
-- =====================================================================
