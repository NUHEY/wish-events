-- RA一括通知の送り主表示と、イベントのカレンダー追加機能の公開設定。
-- 既存環境へ重ねて一度だけ実行できるよう、列・設定行は冪等に追加する。
alter table public.notifications
  add column if not exists sender_label text;

drop function if exists public.send_ra_broadcast_notification(uuid[], text, text, uuid);
drop function if exists public.send_ra_broadcast_notification(uuid[], text, text, uuid, text, text);

create function public.send_ra_broadcast_notification(
  p_target_ids uuid[],
  p_preview_text text,
  p_link text,
  p_broadcast_id uuid,
  p_sender_mode text,
  p_sender_label text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'ra') then
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
  if p_sender_mode is null or p_sender_mode not in ('self', 'system', 'front_desk', 'ra_team', 'custom') then
    raise exception '送り主が正しくありません';
  end if;
  if p_sender_mode = 'custom' and (char_length(trim(coalesce(p_sender_label, ''))) < 1 or char_length(p_sender_label) > 40) then
    raise exception '任意の送り主名は1〜40文字にしてください';
  end if;

  insert into public.notifications (user_id, actor_id, type, link, preview_text, broadcast_id, sender_label)
  select
    u.id,
    case when p_sender_mode = 'self' then auth.uid() else null end,
    'ra_broadcast',
    p_link,
    trim(p_preview_text),
    p_broadcast_id,
    case p_sender_mode
      when 'system' then 'WISH Events'
      when 'front_desk' then '2F窓口'
      when 'ra_team' then 'RAチーム'
      when 'custom' then trim(p_sender_label)
      else null
    end
  from public.users u
  where u.id = any(p_target_ids) and u.floor_number is not null
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.send_ra_broadcast_notification(uuid[], text, text, uuid, text, text) from public;
revoke execute on function public.send_ra_broadcast_notification(uuid[], text, text, uuid, text, text) from anon;
grant execute on function public.send_ra_broadcast_notification(uuid[], text, text, uuid, text, text) to authenticated;

comment on function public.send_ra_broadcast_notification(uuid[], text, text, uuid, text, text) is
  'RAだけが通知の送り主を指定し、最大200人ずつ一括送信できる。';

insert into public.feature_flags (key, state)
values ('event_calendar_export', 'hidden')
on conflict (key) do nothing;
