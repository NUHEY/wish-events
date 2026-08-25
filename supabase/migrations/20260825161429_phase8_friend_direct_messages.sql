-- Phase 8: 友達間の1:1ダイレクトメッセージ機能を追加する。
-- トークを「イベントトーク」と「友達」の2タブに分け、友達（friend_requests.status='accepted'）
-- になった相手同士だけがメッセージを送り合えるようにする。

-- 1) メッセージ本体。既存のevent_messagesと同じ設計思想（本文2000字まで、text/image）。
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  body text not null default '',
  message_type text not null default 'text' check (message_type in ('text', 'image')),
  media_path text,
  created_at timestamptz not null default now(),
  constraint direct_messages_no_self check (sender_id <> recipient_id),
  constraint direct_messages_body_check check (char_length(trim(body)) <= 2000)
);

create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient_id, created_at desc);

comment on table public.direct_messages is
  '友達同士の1:1ダイレクトメッセージ。挿入時に友達関係(accepted)であることをRLSで強制する。';

alter table public.direct_messages enable row level security;

create policy "direct_messages_select_own"
on public.direct_messages for select
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "direct_messages_insert_friends"
on public.direct_messages for insert
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.requester_id = (select auth.uid()) and fr.addressee_id = recipient_id)
        or (fr.addressee_id = (select auth.uid()) and fr.requester_id = recipient_id)
      )
  )
);

grant select, insert on public.direct_messages to authenticated;
revoke select, insert on public.direct_messages from anon;

alter publication supabase_realtime add table public.direct_messages;

-- 2) 既読管理。event_chat_readsと同じ形（相手ユーザーごとに最終既読時刻を持つ）。
create table if not exists public.direct_message_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  other_user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, other_user_id)
);
alter table public.direct_message_reads enable row level security;

create policy "direct_message_reads_select_own"
on public.direct_message_reads for select using (user_id = (select auth.uid()));
create policy "direct_message_reads_insert_own"
on public.direct_message_reads for insert with check (user_id = (select auth.uid()));
create policy "direct_message_reads_update_own"
on public.direct_message_reads for update
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.direct_message_reads to authenticated;
revoke select, insert, update on public.direct_message_reads from anon;

-- 3) 友達一覧タブ用: 友達ごとの最新メッセージ・未読フラグをまとめて1回で返す
--    SECURITY DEFINER関数（行数分のN+1クエリを避けるため）。
create or replace function public.friend_dm_threads()
returns table (
  friend_id uuid,
  last_message_body text,
  last_message_type text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with my_friends as (
    select case when fr.requester_id = auth.uid() then fr.addressee_id else fr.requester_id end as friend_id
    from public.friend_requests fr
    where fr.status = 'accepted' and (fr.requester_id = auth.uid() or fr.addressee_id = auth.uid())
  ),
  last_msg as (
    select distinct on (other_id) other_id, body, message_type, created_at, sender_id
    from (
      select
        case when dm.sender_id = auth.uid() then dm.recipient_id else dm.sender_id end as other_id,
        dm.body, dm.message_type, dm.created_at, dm.sender_id
      from public.direct_messages dm
      where dm.sender_id = auth.uid() or dm.recipient_id = auth.uid()
    ) x
    order by other_id, created_at desc
  ),
  reads as (
    select other_user_id, last_read_at from public.direct_message_reads where user_id = auth.uid()
  )
  select
    f.friend_id,
    lm.body as last_message_body,
    lm.message_type as last_message_type,
    lm.created_at as last_message_at,
    lm.sender_id as last_sender_id,
    (
      lm.created_at is not null
      and (r.last_read_at is null or lm.created_at > r.last_read_at)
      and lm.sender_id is distinct from auth.uid()
    ) as unread
  from my_friends f
  left join last_msg lm on lm.other_id = f.friend_id
  left join reads r on r.other_user_id = f.friend_id
  order by lm.created_at desc nulls last;
$$;

revoke all on function public.friend_dm_threads() from public;
revoke execute on function public.friend_dm_threads() from anon;
grant execute on function public.friend_dm_threads() to authenticated;

comment on function public.friend_dm_threads() is
  'トーク画面「友達」タブ用。承認済みの友達それぞれについて最新メッセージと未読フラグをまとめて返す。全dormログインユーザーが実行可。';

-- 4) DM画像は送信者・受信者の2人だけが読み書きできる非公開バケット。
--    フォルダ名は2人のuser_idをソートして'_'で連結したもの（例: {小さい方}_{大きい方}）。
create or replace function public.can_access_dm_media(p_pair text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  id1 uuid;
  id2 uuid;
begin
  if p_pair is null or position('_' in p_pair) = 0 then
    return false;
  end if;
  begin
    id1 := split_part(p_pair, '_', 1)::uuid;
    id2 := split_part(p_pair, '_', 2)::uuid;
  exception when others then
    return false;
  end;
  if auth.uid() is distinct from id1 and auth.uid() is distinct from id2 then
    return false;
  end if;
  return exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.requester_id = id1 and fr.addressee_id = id2)
        or (fr.requester_id = id2 and fr.addressee_id = id1)
      )
  );
end;
$$;

revoke all on function public.can_access_dm_media(text) from public;
revoke execute on function public.can_access_dm_media(text) from anon;
grant execute on function public.can_access_dm_media(text) to authenticated;

insert into storage.buckets (id, name, public) values ('dm-media', 'dm-media', false) on conflict (id) do nothing;

create policy "dm_media_select_members" on storage.objects for select using (
  bucket_id = 'dm-media' and public.can_access_dm_media((storage.foldername(name))[1])
);
create policy "dm_media_insert_members" on storage.objects for insert with check (
  bucket_id = 'dm-media' and public.can_access_dm_media((storage.foldername(name))[1])
);
