-- 寮生イベントの保存カテゴリを既存制約に合わせ、公式イベントとは別のホーム欄を追加する。
-- 20260828_wish_knowledge_and_resident_events.sql の旧版を適用済みの環境向けの差分。

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

  insert into public.registrations(event_id, user_id) values (v_id, v_uid);
  return v_id;
end;
$$;

revoke all on function public.create_resident_event(text,text,text,timestamptz,integer,text) from public;
grant execute on function public.create_resident_event(text,text,text,timestamptz,integer,text) to authenticated;
