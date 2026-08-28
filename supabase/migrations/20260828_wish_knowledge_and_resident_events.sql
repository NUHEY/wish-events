-- WISH知恵袋と寮生イベントは、RAの機能公開設定から段階的に公開する。
-- 既定は非公開。公開前でもRAは内容を確認できる。
insert into public.feature_flags (key, state, show_on_home, home_position)
values
  ('wish_knowledge', 'hidden', true, 8),
  ('resident_events', 'hidden', true, 9)
on conflict (key) do nothing;

-- 寮生募集は公式イベントの各セクションへ混ぜず、ホーム上の独立した欄として管理する。
-- 既に前版を実行済みでも、このファイルを再実行すれば安全に設定が追加される。
alter table public.home_layout_sections
  drop constraint if exists home_layout_sections_section_key_check;
alter table public.home_layout_sections
  add constraint home_layout_sections_section_key_check
  check (section_key in (
    'week_events', 'floor_events', 'announcements',
    'featured_events', 'popular_events', 'friends_events', 'resident_events', 'tools'
  ));

update public.home_layout_sections
set position = 8
where section_key = 'tools' and position = 7;

insert into public.home_layout_sections (section_key, visible, position)
values ('resident_events', true, 7)
on conflict (section_key) do nothing;

-- 既存イベントの申込・トーク・コメント・いいねをそのまま利用しつつ、
-- RA企画と寮生企画を表示・権限上で区別する。
alter table public.events
  add column if not exists creator_type text not null default 'ra',
  add column if not exists moderation_status text not null default 'published';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_creator_type_check') then
    alter table public.events add constraint events_creator_type_check check (creator_type in ('ra', 'resident'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_moderation_status_check') then
    alter table public.events add constraint events_moderation_status_check check (moderation_status in ('published', 'pending', 'rejected'));
  end if;
end $$;

create index if not exists events_creator_type_date_idx on public.events(creator_type, event_date desc);

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events for select to authenticated
using (
  public.is_ra()
  or created_by = (select auth.uid())
  or (
    moderation_status = 'published'
    and (publish_at is null or publish_at <= now())
    and (target_floors is null or array_length(target_floors, 1) is null or public.current_user_floor() = any(target_floors))
  )
  or exists (select 1 from public.registrations r where r.event_id = events.id and r.user_id = (select auth.uid()))
);

drop policy if exists "events_delete_own_resident" on public.events;
create policy "events_delete_own_resident" on public.events for delete to authenticated
using (creator_type = 'resident' and created_by = (select auth.uid()));

drop policy if exists "event_posters_insert_resident" on storage.objects;
create policy "event_posters_insert_resident" on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-posters'
  and public.beta_feature_enabled('resident_events')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'community'
);

create or replace function public.create_resident_event(
  p_title text,
  p_description text,
  p_location text,
  p_event_date timestamptz,
  p_capacity integer,
  p_image_url text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;
  if not public.is_ra() and not public.beta_feature_enabled('resident_events') then raise exception 'この機能は現在公開されていません'; end if;
  if char_length(trim(p_title)) not between 1 and 120 then raise exception 'タイトルは120文字以内で入力してください'; end if;
  if char_length(coalesce(p_description, '')) > 1200 then raise exception '説明は1200文字以内で入力してください'; end if;
  if char_length(coalesce(p_location, '')) > 200 then raise exception '場所は200文字以内で入力してください'; end if;
  if p_event_date <= now() or p_event_date > now() + interval '180 days' then raise exception '開催日時は180日以内の未来を選択してください'; end if;
  if p_capacity is not null and (p_capacity < 2 or p_capacity > 100) then raise exception '定員は2〜100人で設定してください'; end if;
  if p_image_url is not null and p_image_url <> '' and p_image_url !~ '^(/images/event-presets/|https?://[^/]+/storage/v1/object/public/event-posters/)' then raise exception '画像URLが正しくありません'; end if;

  insert into public.events (
    title, category, description, poster_url, thumbnail_url, location,
    event_date, requires_registration, capacity, fee_amount, show_free_tag,
    target_audience, survey_type, is_pinned, member_ids, all_ra_members,
    created_by, creator_type, moderation_status
  ) values (
    trim(p_title), 'その他', nullif(trim(coalesce(p_description, '')), ''),
    nullif(p_image_url, ''), nullif(p_image_url, ''), nullif(trim(coalesce(p_location, '')), ''),
    p_event_date, true, p_capacity, null, true,
    'WISH寮生', 'none', false, array[v_uid], false,
    v_uid, 'resident', 'published'
  ) returning id into v_id;
  -- 主催者も参加者として登録し、作成直後から既存のトークリストと未読通知を利用する。
  insert into public.registrations(event_id, user_id) values (v_id, v_uid);
  return v_id;
end;
$$;
revoke all on function public.create_resident_event(text,text,text,timestamptz,integer,text) from public;
grant execute on function public.create_resident_event(text,text,text,timestamptz,integer,text) to authenticated;

create or replace function public.can_access_event_talk(target_event_id uuid)
returns boolean language sql security definer stable set search_path = public
as $$
  select public.is_ra()
    or exists (select 1 from public.events where id = target_event_id and created_by = auth.uid())
    or exists (select 1 from public.registrations where event_id = target_event_id and user_id = auth.uid());
$$;
revoke all on function public.can_access_event_talk(uuid) from public;
grant execute on function public.can_access_event_talk(uuid) to authenticated;

-- 寮生同士の質問と複数回答。解決済み回答は質問者本人またはRAだけが選べる。
create table if not exists public.wish_questions (
  id uuid primary key default gen_random_uuid(),
  asked_by uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  category text not null default 'other' check (category in ('life', 'rules', 'study', 'food', 'local', 'other')),
  accepted_answer_id uuid,
  answer_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wish_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.wish_questions(id) on delete cascade,
  answered_by uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wish_questions_accepted_answer_fk') then
    alter table public.wish_questions add constraint wish_questions_accepted_answer_fk foreign key (accepted_answer_id) references public.wish_answers(id) on delete set null;
  end if;
end $$;

create index if not exists wish_questions_created_idx on public.wish_questions(created_at desc);
create index if not exists wish_questions_category_idx on public.wish_questions(category, created_at desc);
create index if not exists wish_answers_question_idx on public.wish_answers(question_id, created_at);

alter table public.wish_questions enable row level security;
alter table public.wish_answers enable row level security;

drop policy if exists "wish_questions_select" on public.wish_questions;
create policy "wish_questions_select" on public.wish_questions for select to authenticated
using (public.is_ra() or public.beta_feature_enabled('wish_knowledge'));
drop policy if exists "wish_questions_insert" on public.wish_questions;
create policy "wish_questions_insert" on public.wish_questions for insert to authenticated
with check (asked_by = (select auth.uid()) and (public.is_ra() or public.beta_feature_enabled('wish_knowledge')));
drop policy if exists "wish_questions_delete" on public.wish_questions;
create policy "wish_questions_delete" on public.wish_questions for delete to authenticated
using (public.is_ra() or asked_by = (select auth.uid()));

drop policy if exists "wish_answers_select" on public.wish_answers;
create policy "wish_answers_select" on public.wish_answers for select to authenticated
using (public.is_ra() or public.beta_feature_enabled('wish_knowledge'));
drop policy if exists "wish_answers_insert" on public.wish_answers;
create policy "wish_answers_insert" on public.wish_answers for insert to authenticated
with check (answered_by = (select auth.uid()) and (public.is_ra() or public.beta_feature_enabled('wish_knowledge')));
drop policy if exists "wish_answers_update" on public.wish_answers;
drop policy if exists "wish_answers_delete" on public.wish_answers;
create policy "wish_answers_delete" on public.wish_answers for delete to authenticated
using (public.is_ra() or answered_by = (select auth.uid()));

grant select, insert, delete on public.wish_questions to authenticated;
revoke update on public.wish_answers from authenticated;
grant select, insert, delete on public.wish_answers to authenticated;

create or replace function public.sync_wish_answer_count()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_question_id uuid;
begin
  v_question_id := case when tg_op = 'DELETE' then old.question_id else new.question_id end;
  update public.wish_questions set answer_count = (select count(*) from public.wish_answers where question_id = v_question_id), updated_at = now() where id = v_question_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_wish_answer_count on public.wish_answers;
create trigger trg_sync_wish_answer_count after insert or delete on public.wish_answers for each row execute function public.sync_wish_answer_count();

create or replace function public.accept_wish_answer(p_question_id uuid, p_answer_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.wish_questions q where q.id = p_question_id and (q.asked_by = auth.uid() or public.is_ra())) then raise exception '回答を選択する権限がありません'; end if;
  if not exists (select 1 from public.wish_answers a where a.id = p_answer_id and a.question_id = p_question_id) then raise exception '回答が見つかりません'; end if;
  update public.wish_questions set accepted_answer_id = p_answer_id, updated_at = now() where id = p_question_id;
end;
$$;
revoke all on function public.accept_wish_answer(uuid,uuid) from public;
grant execute on function public.accept_wish_answer(uuid,uuid) to authenticated;

create or replace function public.notify_wish_answer()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_title text;
begin
  select asked_by, title into v_owner, v_title from public.wish_questions where id = new.question_id;
  if v_owner is not null and v_owner <> new.answered_by then
    insert into public.notifications(user_id, actor_id, type, link, preview_text, sender_label)
    values (v_owner, new.answered_by, 'ra_broadcast', '/wisdom/' || new.question_id::text, left(new.body, 140), 'WISH知恵袋');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_wish_answer on public.wish_answers;
create trigger trg_notify_wish_answer after insert on public.wish_answers for each row execute function public.notify_wish_answer();
