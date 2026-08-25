-- 無料枠への影響が大きい機能をRAが段階公開するための設定。
-- 既存マイグレーションの後に一度だけ実行してください。
create table if not exists public.feature_flags (
  key text primary key,
  state text not null default 'hidden' check (state in ('public', 'beta', 'hidden')),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, state) values ('friend_dm', 'hidden') on conflict (key) do nothing;
alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags_select_authenticated" on public.feature_flags;
create policy "feature_flags_select_authenticated" on public.feature_flags for select to authenticated using (true);
drop policy if exists "feature_flags_insert_ra" on public.feature_flags;
create policy "feature_flags_insert_ra" on public.feature_flags for insert to authenticated
with check (public.is_ra() and updated_by = (select auth.uid()));
drop policy if exists "feature_flags_update_ra" on public.feature_flags;
create policy "feature_flags_update_ra" on public.feature_flags for update to authenticated
using (public.is_ra()) with check (public.is_ra() and updated_by = (select auth.uid()));

revoke all on public.feature_flags from anon;
grant select, insert, update on public.feature_flags to authenticated;
create index if not exists feature_flags_state_idx on public.feature_flags(state);

-- 非公開時はUIだけでなく、直接APIを呼ばれても友達DMを読み書きできないようにする。
drop policy if exists "direct_messages_select_own" on public.direct_messages;
create policy "direct_messages_select_own" on public.direct_messages for select to authenticated using (
  (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  and coalesce((select state from public.feature_flags where key = 'friend_dm'), 'hidden') <> 'hidden'
);

drop policy if exists "direct_messages_insert_friends" on public.direct_messages;
create policy "direct_messages_insert_friends" on public.direct_messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and coalesce((select state from public.feature_flags where key = 'friend_dm'), 'hidden') <> 'hidden'
  and exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and ((fr.requester_id = (select auth.uid()) and fr.addressee_id = recipient_id)
        or (fr.addressee_id = (select auth.uid()) and fr.requester_id = recipient_id))
  )
);

-- SECURITY DEFINERの一覧関数も公開設定を尊重する。
create or replace function public.friend_dm_threads()
returns table (
  friend_id uuid, last_message_body text, last_message_type text,
  last_message_at timestamptz, last_sender_id uuid, unread boolean
)
language sql security definer stable set search_path = public
as $$
  with my_friends as (
    select case when fr.requester_id = auth.uid() then fr.addressee_id else fr.requester_id end as friend_id
    from public.friend_requests fr
    where fr.status = 'accepted' and (fr.requester_id = auth.uid() or fr.addressee_id = auth.uid())
  ),
  last_msg as (
    select distinct on (other_id) other_id, body, message_type, created_at, sender_id
    from (
      select case when dm.sender_id = auth.uid() then dm.recipient_id else dm.sender_id end as other_id,
        dm.body, dm.message_type, dm.created_at, dm.sender_id
      from public.direct_messages dm
      where dm.sender_id = auth.uid() or dm.recipient_id = auth.uid()
    ) x order by other_id, created_at desc
  ),
  reads as (select other_user_id, last_read_at from public.direct_message_reads where user_id = auth.uid())
  select f.friend_id, lm.body, lm.message_type, lm.created_at, lm.sender_id,
    (lm.created_at is not null and (r.last_read_at is null or lm.created_at > r.last_read_at)
      and lm.sender_id is distinct from auth.uid()) as unread
  from my_friends f
  left join last_msg lm on lm.other_id = f.friend_id
  left join reads r on r.other_user_id = f.friend_id
  where coalesce((select state from public.feature_flags where key = 'friend_dm'), 'hidden') <> 'hidden'
  order by lm.created_at desc nulls last;
$$;
revoke all on function public.friend_dm_threads() from public;
grant execute on function public.friend_dm_threads() to authenticated;

-- ヘッダーの赤バッジも、非公開中の友達DMは集計しない。
create or replace function public.has_unread_talks()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.registrations r
    join public.event_messages m on m.event_id = r.event_id
    left join public.event_chat_reads cr on cr.event_id = r.event_id and cr.user_id = auth.uid()
    where r.user_id = auth.uid() and m.sender_id <> auth.uid()
      and m.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
  ) or (
    coalesce((select state from public.feature_flags where key = 'friend_dm'), 'hidden') <> 'hidden'
    and exists (
      select 1 from public.direct_messages dm
      left join public.direct_message_reads dr on dr.user_id = auth.uid() and dr.other_user_id = dm.sender_id
      where dm.recipient_id = auth.uid() and dm.created_at > coalesce(dr.last_read_at, 'epoch'::timestamptz)
    )
  );
$$;
revoke all on function public.has_unread_talks() from public;
grant execute on function public.has_unread_talks() to authenticated;

-- DM画像も非公開時は新規アップロード・表示を止める。
create or replace function public.can_access_dm_media(p_pair text)
returns boolean language plpgsql security definer stable set search_path = public
as $$
declare id1 uuid; id2 uuid;
begin
  if coalesce((select state from public.feature_flags where key = 'friend_dm'), 'hidden') = 'hidden' then return false; end if;
  if p_pair is null or position('_' in p_pair) = 0 then return false; end if;
  begin
    id1 := split_part(p_pair, '_', 1)::uuid;
    id2 := split_part(p_pair, '_', 2)::uuid;
  exception when others then return false;
  end;
  if auth.uid() is distinct from id1 and auth.uid() is distinct from id2 then return false; end if;
  return exists (
    select 1 from public.friend_requests fr where fr.status = 'accepted'
      and ((fr.requester_id = id1 and fr.addressee_id = id2) or (fr.requester_id = id2 and fr.addressee_id = id1))
  );
end;
$$;
revoke all on function public.can_access_dm_media(text) from public;
grant execute on function public.can_access_dm_media(text) to authenticated;
