-- プロフィール公開設定、カバー画像、トーク高速化。
-- Claudeが作成した20260825系マイグレーションの後に、このファイルを一度実行してください。

alter table public.users
  add column if not exists profile_cover_url text,
  add column if not exists show_past_events boolean not null default true,
  add column if not exists show_sns boolean not null default true,
  add column if not exists show_languages boolean not null default true,
  add column if not exists show_nationalities boolean not null default true;

-- usersは列単位でUPDATEを許可しているため、新しい列にも明示的な権限が必要。
grant update (
  profile_cover_url, show_past_events, show_sns, show_languages, show_nationalities
) on public.users to authenticated;

create index if not exists events_category_date_idx on public.events(category, event_date);
create index if not exists registrations_user_registered_idx on public.registrations(user_id, registered_at desc);
create index if not exists event_messages_event_created_desc_idx on public.event_messages(event_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx on public.direct_messages(recipient_id, created_at desc);
create index if not exists event_comments_event_parent_created_idx on public.event_comments(event_id, parent_id, created_at);

-- ヘッダーの未読バッジ用。全メッセージをブラウザへ返さずboolean 1件だけ返す。
create or replace function public.has_unread_talks()
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    exists (
      select 1
      from public.registrations r
      join public.event_messages m on m.event_id = r.event_id
      left join public.event_chat_reads cr on cr.event_id = r.event_id and cr.user_id = auth.uid()
      where r.user_id = auth.uid()
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    )
    or exists (
      select 1
      from public.direct_messages dm
      left join public.direct_message_reads dr
        on dr.user_id = auth.uid() and dr.other_user_id = dm.sender_id
      where dm.recipient_id = auth.uid()
        and dm.created_at > coalesce(dr.last_read_at, 'epoch'::timestamptz)
    );
$$;
revoke all on function public.has_unread_talks() from public;
grant execute on function public.has_unread_talks() to authenticated;

create or replace function public.has_unread_direct_messages()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.direct_messages dm
    left join public.direct_message_reads dr
      on dr.user_id = auth.uid() and dr.other_user_id = dm.sender_id
    where dm.recipient_id = auth.uid()
      and dm.created_at > coalesce(dr.last_read_at, 'epoch'::timestamptz)
  );
$$;
revoke all on function public.has_unread_direct_messages() from public;
grant execute on function public.has_unread_direct_messages() to authenticated;

-- イベントトーク一覧用。部屋・最新メッセージ・未読を1回で取得する。
create or replace function public.event_talk_threads()
returns table (
  event_id uuid, title text, title_en text, event_date timestamptz, poster_url text,
  last_message_body text, last_message_type text, last_message_at timestamptz, unread boolean
)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, e.title_en, e.event_date, e.poster_url,
    lm.body, lm.message_type, lm.created_at,
    exists (
      select 1 from public.event_messages um
      where um.event_id = e.id and um.sender_id <> auth.uid()
        and um.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    ) as unread
  from public.registrations r
  join public.events e on e.id = r.event_id
  left join public.event_chat_reads cr on cr.event_id = e.id and cr.user_id = auth.uid()
  left join lateral (
    select m.body, m.message_type, m.created_at
    from public.event_messages m where m.event_id = e.id
    order by m.created_at desc limit 1
  ) lm on true
  where r.user_id = auth.uid()
  order by coalesce(lm.created_at, r.registered_at) desc;
$$;
revoke all on function public.event_talk_threads() from public;
grant execute on function public.event_talk_threads() to authenticated;

create or replace function public.profile_past_events(p_user_id uuid)
returns table (id uuid, title text, title_en text, event_date timestamptz, poster_url text)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, e.title_en, e.event_date, e.poster_url
  from public.registrations r
  join public.events e on e.id = r.event_id
  join public.users u on u.id = r.user_id
  where r.user_id = p_user_id
    and (u.show_past_events or p_user_id = auth.uid() or public.is_ra())
    and e.event_date < now()
  order by r.registered_at desc limit 12;
$$;
revoke all on function public.profile_past_events(uuid) from public;
grant execute on function public.profile_past_events(uuid) to authenticated;

-- 公開プロフィールに表示設定を反映する。
drop function if exists public.directory_profiles(uuid);
create function public.directory_profiles(p_user_id uuid default null)
returns table (
  id uuid, full_name text, role text, floor_number integer, room_number text,
  faculty text, grade_level text, languages text[], nationalities text[], lived_countries text[],
  instagram_handle text, self_intro text, avatar_url text, line_id text, x_handle text,
  profile_accent text, profile_cover_url text, show_past_events boolean,
  show_sns boolean, show_languages boolean, show_nationalities boolean
)
language sql stable security definer set search_path = public
as $$
  select u.id, u.full_name, u.role, u.floor_number, u.room_number,
    u.faculty, u.grade_level,
    case when u.show_languages or u.id = auth.uid() or public.is_ra() then u.languages else null end,
    case when u.show_nationalities or u.id = auth.uid() or public.is_ra() then u.nationalities else null end,
    case when u.show_nationalities or u.id = auth.uid() or public.is_ra() then u.lived_countries else null end,
    case when u.show_sns or u.id = auth.uid() or public.is_ra() then u.instagram_handle else null end,
    u.self_intro, u.avatar_url,
    case when u.show_sns or u.id = auth.uid() or public.is_ra() then u.line_id else null end,
    case when u.show_sns or u.id = auth.uid() or public.is_ra() then u.x_handle else null end,
    u.profile_accent, u.profile_cover_url, u.show_past_events,
    u.show_sns, u.show_languages, u.show_nationalities
  from public.users u
  where (p_user_id is null or u.id = p_user_id) and u.moved_out_at is null
  order by u.floor_number nulls last, u.room_number nulls last, u.full_name nulls last;
$$;
revoke execute on function public.directory_profiles(uuid) from public;
grant execute on function public.directory_profiles(uuid) to authenticated;
