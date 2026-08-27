-- 事前質問を必ず通るイベント申込と、WISH入居年月による新寮生の自動判定。
-- 20260827_add_resident_beta_tools.sql の後に一度だけ実行してください。

alter table public.users add column if not exists wish_entry_month date;
grant update (wish_entry_month) on public.users to authenticated;

create or replace function public.derive_new_resident_status()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.wish_entry_month is not null then
    new.wish_entry_month := date_trunc('month', new.wish_entry_month)::date;
  end if;
  new.is_new_resident := new.wish_entry_month is not null
    and new.wish_entry_month > (date_trunc('month', current_date) - interval '6 months')::date
    and new.wish_entry_month <= date_trunc('month', current_date)::date;
  return new;
end;
$$;
drop trigger if exists trg_derive_new_resident_status on public.users;
create trigger trg_derive_new_resident_status
before insert or update of wish_entry_month on public.users
for each row execute function public.derive_new_resident_status();

-- 以前の手動切替関数が残っていても一般クライアントからは呼べないようにする。
revoke execute on function public.set_new_resident_status(uuid, boolean) from authenticated;

create or replace function public.is_current_new_resident(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((
    select u.wish_entry_month > (date_trunc('month', current_date) - interval '6 months')::date
      and u.wish_entry_month <= date_trunc('month', current_date)::date
    from public.users u where u.id = p_user_id
  ), false);
$$;
revoke all on function public.is_current_new_resident(uuid) from public;
grant execute on function public.is_current_new_resident(uuid) to authenticated;

-- Let's Chat!は同じ階かつ入居から6か月未満の寮生だけが閲覧できる。
create or replace function public.can_access_schedule_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.schedule_sessions s
    where s.id = p_session_id
      and (
        public.is_ra()
        or (
          public.beta_feature_enabled(public.schedule_feature_key(s.kind))
          and (
            s.created_by = auth.uid()
            or exists (select 1 from public.schedule_participants p where p.session_id = s.id and p.user_id = auth.uid())
            or (s.kind = 'lets_chat' and exists (
              select 1 from public.users u
              where u.id = auth.uid() and u.floor_number = s.floor_number
                and public.is_current_new_resident(u.id)
            ))
          )
        )
      )
  );
$$;

create or replace function public.book_lets_chat_slot(p_session_id uuid, p_ra_id uuid, p_start_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_session public.schedule_sessions%rowtype;
  v_end timestamptz;
  v_booking_id uuid;
begin
  select * into v_session from public.schedule_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.kind <> 'lets_chat' or v_session.status <> 'open'
    or not public.beta_feature_enabled('lets_chat_booking') then
    raise exception '現在この予約は受け付けていません';
  end if;
  if not exists (
    select 1 from public.users
    where id = auth.uid() and floor_number = v_session.floor_number
      and public.is_current_new_resident(id)
  ) then raise exception '対象フロアの新寮生だけが予約できます'; end if;
  if not exists (
    select 1 from public.schedule_participants
    where session_id = p_session_id and user_id = p_ra_id and participant_role = 'ra'
  ) then raise exception '選択したRAはこの日程に参加していません'; end if;
  select end_at into v_end from public.schedule_availability
    where session_id = p_session_id and user_id = p_ra_id and start_at = p_start_at;
  if v_end is null then raise exception '選択した時間は予約できません'; end if;
  insert into public.schedule_bookings(session_id, resident_id, ra_id, start_at, end_at)
  values (p_session_id, auth.uid(), p_ra_id, p_start_at, v_end)
  returning id into v_booking_id;
  return v_booking_id;
exception
  when unique_violation then raise exception 'この時間は先に予約されたか、すでに予約済みです';
end;
$$;

-- 削除された質問も過去回答とともに保存するため、物理削除ではなく非表示にする。
alter table public.registration_questions add column if not exists is_active boolean not null default true;
create index if not exists registration_questions_event_active_position_idx
  on public.registration_questions(event_id, is_active, position);

create or replace function public.replace_registration_questions(p_event_id uuid, p_questions jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_question jsonb;
  v_id uuid;
  v_type text;
  v_text text;
  v_options text[];
  v_required boolean;
  v_position integer := 0;
  v_kept_ids uuid[] := array[]::uuid[];
begin
  if not public.is_ra() then raise exception 'RA権限が必要です'; end if;
  if not exists (select 1 from public.events where id = p_event_id) then raise exception 'イベントが見つかりません'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 20 then
    raise exception '質問は20件以内で設定してください';
  end if;
  for v_question in select * from jsonb_array_elements(p_questions)
  loop
    v_text := trim(coalesce(v_question->>'question_text', ''));
    v_type := coalesce(v_question->>'question_type', '');
    v_required := coalesce((v_question->>'is_required')::boolean, true);
    if char_length(v_text) < 1 or char_length(v_text) > 300 then raise exception '質問文は1〜300文字で入力してください'; end if;
    if v_type not in ('text', 'single_choice', 'multiple_choice') then raise exception '質問形式が正しくありません'; end if;
    if v_type in ('single_choice', 'multiple_choice') then
      if jsonb_typeof(v_question->'options') <> 'array' then raise exception '選択式の選択肢を入力してください'; end if;
      select array_agg(trim(value)) into v_options from jsonb_array_elements_text(v_question->'options');
      if coalesce(array_length(v_options, 1), 0) < 2 or array_length(v_options, 1) > 20
        or exists (select 1 from unnest(v_options) option where option = '' or char_length(option) > 120) then
        raise exception '選択肢は2〜20件、各120文字以内で設定してください';
      end if;
    else
      v_options := null;
    end if;
    v_id := nullif(v_question->>'id', '')::uuid;
    if v_id is not null then
      if not exists (select 1 from public.registration_questions where id = v_id and event_id = p_event_id) then
        raise exception '更新対象の質問が見つかりません';
      end if;
      update public.registration_questions set question_text = v_text, question_type = v_type,
        options = v_options, is_required = v_required, position = v_position, is_active = true where id = v_id;
    else
      insert into public.registration_questions(event_id, question_text, question_type, options, is_required, position, is_active)
      values (p_event_id, v_text, v_type, v_options, v_required, v_position, true) returning id into v_id;
    end if;
    v_kept_ids := array_append(v_kept_ids, v_id);
    v_position := v_position + 1;
  end loop;
  if cardinality(v_kept_ids) = 0 then
    update public.registration_questions set is_active = false where event_id = p_event_id and is_active;
  else
    update public.registration_questions set is_active = false
      where event_id = p_event_id and is_active and not (id = any(v_kept_ids));
  end if;
  update public.events set registration_requires_answers = v_position > 0, updated_at = now() where id = p_event_id;
  return v_position;
end;
$$;
revoke all on function public.replace_registration_questions(uuid, jsonb) from public;
grant execute on function public.replace_registration_questions(uuid, jsonb) to authenticated;

-- 質問の物理削除や直接書換えを止め、履歴保持型RPCだけを編集経路にする。
revoke insert, update, delete on public.registration_questions from authenticated;

-- 受付判定・定員・質問検証・申込・回答保存を1トランザクションで完了する。
create or replace function public.register_for_event(p_event_id uuid, p_answers jsonb default '[]'::jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_profile public.users%rowtype;
  v_question public.registration_questions%rowtype;
  v_answer jsonb;
  v_answer_item jsonb;
  v_registration_id uuid;
  v_text text;
  v_options text[];
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 20 then raise exception '回答の形式が正しくありません'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  select * into v_profile from public.users where id = auth.uid();
  if v_event.id is null then raise exception 'イベントが見つかりません'; end if;
  if v_profile.id is null or v_profile.floor_number is null or v_profile.moved_out_at is not null then raise exception 'プロフィールの住居情報を確認してください'; end if;
  if not public.is_ra() and v_event.publish_at is not null and v_event.publish_at > now() then raise exception 'このイベントはまだ公開されていません'; end if;
  if not public.is_ra() and v_event.target_floors is not null and array_length(v_event.target_floors, 1) is not null
    and not (v_profile.floor_number = any(v_event.target_floors)) then raise exception 'このイベントの対象フロアではありません'; end if;
  if v_event.event_date <= now() then raise exception '終了したイベントには申し込めません'; end if;
  if v_event.registration_opens_at is not null and v_event.registration_opens_at > now() then raise exception '申し込み受付はまだ始まっていません'; end if;
  if v_event.registration_closes_at is not null and v_event.registration_closes_at < now() then raise exception '申し込み受付は終了しました'; end if;
  if exists (select 1 from public.registrations where event_id = p_event_id and user_id = auth.uid()) then raise exception '既に申し込み済みです'; end if;
  if v_event.capacity is not null and (select count(*) from public.registrations where event_id = p_event_id) >= v_event.capacity then raise exception '定員に達しています'; end if;
  for v_answer_item in select * from jsonb_array_elements(p_answers)
  loop
    if not exists (select 1 from public.registration_questions
      where id = (v_answer_item->>'question_id')::uuid and event_id = p_event_id and is_active) then
      raise exception '回答対象の質問が正しくありません';
    end if;
    if (select count(*) from jsonb_array_elements(p_answers) a where a->>'question_id' = v_answer_item->>'question_id') > 1 then
      raise exception '同じ質問への回答が重複しています';
    end if;
  end loop;
  for v_question in select * from public.registration_questions where event_id = p_event_id and is_active order by position
  loop
    select a into v_answer from jsonb_array_elements(p_answers) a where a->>'question_id' = v_question.id::text limit 1;
    v_text := trim(coalesce(v_answer->>'answer_text', ''));
    if jsonb_typeof(v_answer->'answer_options') = 'array' then
      select array_agg(value) into v_options from jsonb_array_elements_text(v_answer->'answer_options');
    else v_options := null; end if;
    if v_question.question_type = 'text' and v_question.is_required and v_text = '' then raise exception '必須の事前質問に回答してください'; end if;
    if v_question.question_type = 'single_choice' and v_question.is_required and coalesce(array_length(v_options, 1), 0) <> 1 then raise exception '必須の事前質問に回答してください'; end if;
    if v_question.question_type = 'multiple_choice' and v_question.is_required and coalesce(array_length(v_options, 1), 0) < 1 then raise exception '必須の事前質問に回答してください'; end if;
    if v_question.question_type in ('single_choice', 'multiple_choice') and v_options is not null
      and exists (select 1 from unnest(v_options) option where not (option = any(v_question.options))) then raise exception '選択肢にない回答が含まれています'; end if;
    if v_question.question_type = 'single_choice' and coalesce(array_length(v_options, 1), 0) > 1 then raise exception '回答形式が正しくありません'; end if;
  end loop;
  insert into public.registrations(event_id, user_id) values (p_event_id, auth.uid()) returning id into v_registration_id;
  for v_answer_item in select * from jsonb_array_elements(p_answers)
  loop
    v_text := trim(coalesce(v_answer_item->>'answer_text', ''));
    if jsonb_typeof(v_answer_item->'answer_options') = 'array' then
      select array_agg(value) into v_options from jsonb_array_elements_text(v_answer_item->'answer_options');
    else v_options := null; end if;
    if v_text <> '' or coalesce(array_length(v_options, 1), 0) > 0 then
      insert into public.registration_answers(registration_id, question_id, answer_text, answer_options)
      values (v_registration_id, (v_answer_item->>'question_id')::uuid, nullif(v_text, ''), v_options);
    end if;
  end loop;
  return v_registration_id;
end;
$$;
revoke all on function public.register_for_event(uuid, jsonb) from public;
grant execute on function public.register_for_event(uuid, jsonb) to authenticated;

-- registrationsへの直接INSERTでは質問検証を通らないため、申込作成は上のRPCだけに限定する。
revoke insert on public.registrations from authenticated;
revoke insert on public.registration_answers from authenticated;
