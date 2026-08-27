-- 日程調整の作成を1トランザクションにまとめ、ホーム掲載ツールと
-- アンケート回答の整合性を追加する。既存マイグレーションの後に一度だけ実行する。

-- ---------------------------------------------------------------------
-- 1. ホームに掲載するツールをRAが個別に選べるようにする
-- ---------------------------------------------------------------------
-- 列単位GRANTを使う環境で、後から追加されたプロフィール列も本人が保存できるようにする。
grant update (profile_accents, wish_entry_month) on public.users to authenticated;

alter table public.feature_flags
  add column if not exists show_on_home boolean not null default false,
  add column if not exists home_position integer not null default 0;

update public.feature_flags
set show_on_home = key in ('availability_matching', 'lets_chat_booking', 'unit_room_sessions', 'ra_question_box', 'ra_link_hub'),
    home_position = case key
  when 'availability_matching' then 1
  when 'lets_chat_booking' then 2
  when 'unit_room_sessions' then 3
  when 'ra_question_box' then 4
  when 'ra_link_hub' then 5
  else home_position
end
where home_position = 0;

alter table public.home_layout_sections
  drop constraint if exists home_layout_sections_section_key_check;
alter table public.home_layout_sections
  add constraint home_layout_sections_section_key_check
  check (section_key in (
    'week_events', 'floor_events', 'announcements',
    'featured_events', 'popular_events', 'friends_events', 'tools'
  ));

insert into public.home_layout_sections (section_key, visible, position)
values ('tools', true, 7)
on conflict (section_key) do nothing;

-- ---------------------------------------------------------------------
-- 2. 日程調整作成をDB内で検証・一括保存する
-- ---------------------------------------------------------------------
drop policy if exists "schedule_sessions_insert_enabled" on public.schedule_sessions;
create policy "schedule_sessions_insert_enabled"
on public.schedule_sessions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (kind = 'general' and public.beta_feature_enabled('availability_matching'))
    or (kind in ('lets_chat', 'urs') and public.is_ra())
  )
);

create or replace function public.create_schedule_session(
  p_kind text,
  p_title text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_daily_start_time time,
  p_daily_end_time time,
  p_slot_minutes integer,
  p_floor_number integer,
  p_participant_ids uuid[],
  p_ra_ids uuid[]
)
returns table (id uuid, share_token uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_session_id uuid;
  v_share_token uuid;
  v_participants uuid[] := coalesce(p_participant_ids, array[]::uuid[]);
  v_ras uuid[] := coalesce(p_ra_ids, array[]::uuid[]);
  v_all_ids uuid[];
begin
  if v_user_id is null then raise exception 'ログインが必要です'; end if;
  select u.role into v_role from public.users u where u.id = v_user_id;
  if v_role is null then raise exception 'プロフィールが見つかりません'; end if;
  if p_kind not in ('general', 'lets_chat', 'urs') then raise exception '日程の種類が正しくありません'; end if;
  if p_kind in ('lets_chat', 'urs') and v_role <> 'ra' then raise exception 'この日程はRAだけが作成できます'; end if;
  if p_kind = 'general' and not public.beta_feature_enabled('availability_matching') and v_role <> 'ra' then
    raise exception 'この機能は現在公開されていません';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80 then raise exception 'タイトルは1〜80文字で入力してください'; end if;
  if char_length(coalesce(p_description, '')) > 500 then raise exception '説明は500文字以内で入力してください'; end if;
  if p_end_date < p_start_date or p_end_date > p_start_date + 31 then raise exception '期間は開始日から31日以内で設定してください'; end if;
  if p_daily_end_time <= p_daily_start_time then raise exception '時間帯を正しく設定してください'; end if;
  if p_slot_minutes not in (15, 30, 60) then raise exception '時間枠が正しくありません'; end if;
  if p_kind <> 'general' and (p_floor_number is null or p_floor_number not between 1 and 20) then raise exception '対象フロアを選択してください'; end if;

  select coalesce(array_agg(distinct value), array[]::uuid[]) into v_participants
  from unnest(v_participants) value;
  select coalesce(array_agg(distinct value), array[]::uuid[]) into v_ras
  from unnest(v_ras) value;
  v_all_ids := array(select distinct value from unnest(v_participants || v_ras) value);

  if cardinality(v_all_ids) > 30 then raise exception '参加者は30人以内で選択してください'; end if;
  if p_kind = 'general' and cardinality(v_participants) < 2 then raise exception '2人以上を選択してください'; end if;
  if p_kind = 'lets_chat' and cardinality(v_ras) < 1 then raise exception '担当RAを1人以上選択してください'; end if;
  if p_kind = 'urs' and (cardinality(v_participants) not between 2 and 4 or cardinality(v_ras) <> 1) then
    raise exception 'URSは寮生2〜4人と担当RA1人を選択してください';
  end if;
  if exists (select 1 from unnest(v_all_ids) selected_id left join public.users u on u.id = selected_id where u.id is null) then
    raise exception '選択した参加者が見つかりません';
  end if;
  if exists (select 1 from unnest(v_ras) selected_id join public.users u on u.id = selected_id where u.role <> 'ra') then
    raise exception 'RAではない寮生が担当RAに含まれています';
  end if;
  if p_kind = 'lets_chat' and exists (
    select 1 from unnest(v_ras) selected_id join public.users u on u.id = selected_id
    where u.floor_number is distinct from p_floor_number
  ) then raise exception '対象フロアのRAだけを選択してください'; end if;

  insert into public.schedule_sessions (
    kind, title, description, created_by, floor_number, start_date, end_date,
    daily_start_time, daily_end_time, slot_minutes
  ) values (
    p_kind, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), v_user_id,
    case when p_kind = 'general' then null else p_floor_number end,
    p_start_date, p_end_date, p_daily_start_time, p_daily_end_time, p_slot_minutes
  ) returning schedule_sessions.id, schedule_sessions.share_token into v_session_id, v_share_token;

  insert into public.schedule_participants (session_id, user_id, participant_role)
  select v_session_id, selected_id,
    case when selected_id = any(v_ras) then 'ra' else 'participant' end
  from unnest(v_all_ids) selected_id;

  return query select v_session_id, v_share_token;
end;
$$;
revoke all on function public.create_schedule_session(text,text,text,date,date,time,time,integer,integer,uuid[],uuid[]) from public;
grant execute on function public.create_schedule_session(text,text,text,date,date,time,time,integer,integer,uuid[],uuid[]) to authenticated;

alter table public.schedule_bookings add column if not exists completed_at timestamptz;

create or replace function public.set_schedule_status(p_session_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_ra() then raise exception 'RA権限が必要です'; end if;
  if p_status not in ('open', 'closed') then raise exception '状態が正しくありません'; end if;
  update public.schedule_sessions set status = p_status, updated_at = now() where id = p_session_id;
  if not found then raise exception '日程が見つかりません'; end if;
end;
$$;
revoke all on function public.set_schedule_status(uuid,text) from public;
grant execute on function public.set_schedule_status(uuid,text) to authenticated;

create or replace function public.delete_schedule_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_ra() then raise exception 'RA権限が必要です'; end if;
  delete from public.schedule_sessions where id = p_session_id;
  if not found then raise exception '日程が見つかりません'; end if;
end;
$$;
revoke all on function public.delete_schedule_session(uuid) from public;
grant execute on function public.delete_schedule_session(uuid) to authenticated;

create or replace function public.set_lets_chat_completed(p_booking_id uuid, p_completed boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_ra() then raise exception 'RA権限が必要です'; end if;
  update public.schedule_bookings
  set completed_at = case when p_completed then now() else null end
  where id = p_booking_id;
  if not found then raise exception '予約が見つかりません'; end if;
end;
$$;
revoke all on function public.set_lets_chat_completed(uuid,boolean) from public;
grant execute on function public.set_lets_chat_completed(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. アンケート回答を1トランザクションで保存する
-- ---------------------------------------------------------------------
create or replace function public.save_event_survey(p_event_id uuid, p_title text, p_questions jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_survey_id uuid;
  v_question jsonb;
  v_type text;
  v_options text[];
  v_position integer := 0;
begin
  if not public.is_ra() then raise exception 'RA権限が必要です'; end if;
  if not exists (select 1 from public.events where id = p_event_id) then raise exception 'イベントが見つかりません'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 120 then raise exception 'タイトルを入力してください'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 50 then
    raise exception '質問は1〜50件で設定してください';
  end if;

  select id into v_survey_id from public.surveys where event_id = p_event_id for update;
  if v_survey_id is not null and exists (select 1 from public.survey_responses where survey_id = v_survey_id) then
    raise exception '回答データを守るため、回答開始後は質問を変更できません';
  end if;
  if v_survey_id is null then
    insert into public.surveys (event_id, title, created_by)
    values (p_event_id, trim(p_title), auth.uid()) returning id into v_survey_id;
  else
    update public.surveys set title = trim(p_title), updated_at = now() where id = v_survey_id;
    delete from public.survey_questions where survey_id = v_survey_id;
  end if;

  for v_question in select * from jsonb_array_elements(p_questions)
  loop
    v_type := coalesce(v_question->>'question_type', '');
    if v_type not in ('text', 'single_choice', 'multiple_choice', 'rating') then raise exception '質問形式が正しくありません'; end if;
    if char_length(trim(coalesce(v_question->>'question_text', ''))) not between 1 and 500 then raise exception '質問文を入力してください'; end if;
    if v_type in ('single_choice', 'multiple_choice') then
      select array_agg(trim(value)) into v_options from jsonb_array_elements_text(coalesce(v_question->'options', '[]'::jsonb));
      if coalesce(array_length(v_options, 1), 0) < 2 then raise exception '選択肢を2つ以上入力してください'; end if;
    elsif v_type = 'rating' then
      v_options := array['1','2','3','4','5'];
    else
      v_options := null;
    end if;
    insert into public.survey_questions (survey_id, question_text, question_type, options, is_required, position)
    values (v_survey_id, trim(v_question->>'question_text'), v_type, v_options, coalesce((v_question->>'is_required')::boolean, true), v_position);
    v_position := v_position + 1;
  end loop;
  update public.events set survey_type = 'internal', updated_at = now() where id = p_event_id;
  return v_survey_id;
end;
$$;
revoke all on function public.save_event_survey(uuid,text,jsonb) from public;
grant execute on function public.save_event_survey(uuid,text,jsonb) to authenticated;

create or replace function public.submit_survey_response(p_survey_id uuid, p_answers jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_question public.survey_questions%rowtype;
  v_answer jsonb;
  v_text text;
  v_options text[];
  v_response_id uuid;
begin
  if v_user_id is null then raise exception 'ログインが必要です'; end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 50 then raise exception '回答の形式が正しくありません'; end if;
  select event_id into v_event_id from public.surveys where id = p_survey_id and is_active;
  if v_event_id is null then raise exception 'このアンケートは現在受け付けていません'; end if;
  if not public.is_ra() and not exists (
    select 1 from public.registrations where event_id = v_event_id and user_id = v_user_id
  ) then raise exception 'イベント参加者だけが回答できます'; end if;
  if exists (select 1 from public.survey_responses where survey_id = p_survey_id and user_id = v_user_id) then
    raise exception 'このアンケートには既に回答済みです';
  end if;

  for v_question in select * from public.survey_questions where survey_id = p_survey_id order by position
  loop
    select item into v_answer from jsonb_array_elements(p_answers) item
      where item->>'question_id' = v_question.id::text limit 1;
    v_text := trim(coalesce(v_answer->>'answer_text', ''));
    if jsonb_typeof(v_answer->'answer_options') = 'array' then
      select array_agg(value) into v_options from jsonb_array_elements_text(v_answer->'answer_options');
    else v_options := null; end if;
    if v_question.is_required and v_question.question_type = 'text' and v_text = '' then raise exception '必須の質問に回答してください'; end if;
    if v_question.is_required and v_question.question_type in ('single_choice', 'rating') and coalesce(array_length(v_options, 1), 0) <> 1 and v_text = '' then raise exception '必須の質問に回答してください'; end if;
    if v_question.is_required and v_question.question_type = 'multiple_choice' and coalesce(array_length(v_options, 1), 0) < 1 then raise exception '必須の質問に回答してください'; end if;
    if v_question.question_type in ('single_choice', 'multiple_choice') and v_options is not null
      and exists (select 1 from unnest(v_options) option where not (option = any(v_question.options))) then
      raise exception '選択肢にない回答が含まれています';
    end if;
    if v_question.question_type = 'single_choice' and v_text <> '' and not (v_text = any(v_question.options)) then
      raise exception '選択肢にない回答が含まれています';
    end if;
    if v_question.question_type = 'rating' and v_text <> '' and v_text not in ('1', '2', '3', '4', '5') then
      raise exception '評価は1〜5で回答してください';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_answers) item
    where not exists (select 1 from public.survey_questions q where q.id = (item->>'question_id')::uuid and q.survey_id = p_survey_id)
  ) then raise exception '回答対象の質問が正しくありません'; end if;

  insert into public.survey_responses (survey_id, user_id)
  values (p_survey_id, v_user_id) returning id into v_response_id;

  insert into public.survey_answers (response_id, question_id, answer_text, answer_options)
  select v_response_id, (item->>'question_id')::uuid,
    nullif(trim(coalesce(item->>'answer_text', '')), ''),
    case when jsonb_typeof(item->'answer_options') = 'array'
      then array(select jsonb_array_elements_text(item->'answer_options')) else null end
  from jsonb_array_elements(p_answers) item
  where nullif(trim(coalesce(item->>'answer_text', '')), '') is not null
     or jsonb_array_length(coalesce(item->'answer_options', '[]'::jsonb)) > 0;

  return v_response_id;
end;
$$;
revoke all on function public.submit_survey_response(uuid,jsonb) from public;
grant execute on function public.submit_survey_response(uuid,jsonb) to authenticated;

revoke insert on public.survey_responses from authenticated;
revoke insert on public.survey_answers from authenticated;
