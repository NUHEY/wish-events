-- RAが対象を絞った通知を安全に一括送信するためのRPC。
-- notificationsへの直接INSERT権限は開放せず、RA確認済みの関数だけに限定する。
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'friend_request', 'friend_accept',
    'event_like', 'event_comment', 'event_comment_reply', 'event_comment_like',
    'announcement_comment', 'announcement_comment_reply', 'announcement_comment_like',
    'ra_broadcast'
  ));

alter table public.notifications
  add column if not exists broadcast_id uuid;

create unique index if not exists notifications_broadcast_recipient_unique
  on public.notifications(broadcast_id, user_id)
  where broadcast_id is not null;

create or replace function public.send_ra_broadcast_notification(
  p_target_ids uuid[],
  p_preview_text text,
  p_link text,
  p_broadcast_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and role = 'ra'
  ) then
    raise exception 'RA権限が必要です';
  end if;

  if coalesce(cardinality(p_target_ids), 0) < 1 or cardinality(p_target_ids) > 200 then
    raise exception '送信対象は1バッチ1〜200人にしてください';
  end if;
  if char_length(trim(coalesce(p_preview_text, ''))) < 1 or char_length(p_preview_text) > 180 then
    raise exception '本文は1〜180文字にしてください';
  end if;
  if p_link is null or p_link !~ '^/' or char_length(p_link) > 500 then
    raise exception 'リンクはサイト内のパスで指定してください';
  end if;

  insert into public.notifications (user_id, actor_id, type, link, preview_text, broadcast_id)
  select u.id, auth.uid(), 'ra_broadcast', p_link, trim(p_preview_text), p_broadcast_id
  from public.users u
  where u.id = any(p_target_ids)
    and u.floor_number is not null
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.send_ra_broadcast_notification(uuid[], text, text, uuid) from public;
revoke execute on function public.send_ra_broadcast_notification(uuid[], text, text, uuid) from anon;
grant execute on function public.send_ra_broadcast_notification(uuid[], text, text, uuid) to authenticated;

comment on function public.send_ra_broadcast_notification(uuid[], text, text, uuid) is
  'RAだけが最大200人ずつ通知を一括作成できる。broadcast_idで再試行時の重複を防ぐ。';
