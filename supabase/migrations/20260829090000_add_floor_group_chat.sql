-- 同じ階に住む寮生・RAが自動的に参加するフロアグループトーク。
-- users.floor_number を所属判定の唯一の基準にし、別フロアの履歴はRLSで読み書きできない。

insert into public.feature_flags (key, state)
values ('floor_group_chat', 'public')
on conflict (key) do nothing;

create table if not exists public.floor_messages (
  id uuid primary key default gen_random_uuid(),
  floor_number integer not null check (floor_number between 3 and 11),
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint floor_messages_body_check check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists floor_messages_floor_created_idx
  on public.floor_messages(floor_number, created_at desc);

alter table public.floor_messages enable row level security;

drop policy if exists "floor_messages_select_same_floor" on public.floor_messages;
create policy "floor_messages_select_same_floor"
on public.floor_messages for select to authenticated
using (
  coalesce((select state from public.feature_flags where key = 'floor_group_chat'), 'hidden') <> 'hidden'
  and exists (
    select 1 from public.users me
    where me.id = (select auth.uid())
      and me.moved_out_at is null
      and me.floor_number = floor_messages.floor_number
  )
);

drop policy if exists "floor_messages_insert_same_floor" on public.floor_messages;
create policy "floor_messages_insert_same_floor"
on public.floor_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and coalesce((select state from public.feature_flags where key = 'floor_group_chat'), 'hidden') <> 'hidden'
  and exists (
    select 1 from public.users me
    where me.id = (select auth.uid())
      and me.moved_out_at is null
      and me.floor_number = floor_messages.floor_number
  )
);

grant select, insert on public.floor_messages to authenticated;
revoke all on public.floor_messages from anon;

do $$
begin
  alter publication supabase_realtime add table public.floor_messages;
exception when duplicate_object then null;
end $$;

create table if not exists public.floor_message_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  floor_number integer not null check (floor_number between 3 and 11),
  last_read_at timestamptz not null default now(),
  primary key (user_id, floor_number)
);

alter table public.floor_message_reads enable row level security;

drop policy if exists "floor_message_reads_select_own" on public.floor_message_reads;
create policy "floor_message_reads_select_own"
on public.floor_message_reads for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "floor_message_reads_insert_own_floor" on public.floor_message_reads;
create policy "floor_message_reads_insert_own_floor"
on public.floor_message_reads for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.users me
    where me.id = (select auth.uid()) and me.floor_number = floor_message_reads.floor_number
  )
);

drop policy if exists "floor_message_reads_update_own_floor" on public.floor_message_reads;
create policy "floor_message_reads_update_own_floor"
on public.floor_message_reads for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.users me
    where me.id = (select auth.uid()) and me.floor_number = floor_message_reads.floor_number
  )
);

grant select, insert, update on public.floor_message_reads to authenticated;
revoke all on public.floor_message_reads from anon;

-- 一覧画面用。本人の現在フロアについて、最新メッセージ・未読・人数を1回で返す。
create or replace function public.floor_group_thread()
returns table (
  floor_number integer,
  last_message_body text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread boolean,
  member_count bigint
)
language sql security definer stable set search_path = public
as $$
  with me as (
    select u.floor_number
    from public.users u
    where u.id = auth.uid() and u.moved_out_at is null
  ), latest as (
    select fm.body, fm.created_at, fm.sender_id
    from public.floor_messages fm, me
    where fm.floor_number = me.floor_number
    order by fm.created_at desc
    limit 1
  )
  select
    me.floor_number,
    latest.body,
    latest.created_at,
    latest.sender_id,
    (
      latest.created_at is not null
      and latest.sender_id is distinct from auth.uid()
      and latest.created_at > coalesce(fr.last_read_at, 'epoch'::timestamptz)
    ),
    (select count(*) from public.users u where u.floor_number = me.floor_number and u.moved_out_at is null)
  from me
  left join latest on true
  left join public.floor_message_reads fr
    on fr.user_id = auth.uid() and fr.floor_number = me.floor_number
  where me.floor_number is not null
    and coalesce((select state from public.feature_flags where key = 'floor_group_chat'), 'hidden') <> 'hidden';
$$;

revoke all on function public.floor_group_thread() from public;
grant execute on function public.floor_group_thread() to authenticated;

-- グループ内の送信者表示用。本人と同じ階の公開に必要な最小プロフィールだけを返す。
create or replace function public.floor_group_profiles()
returns table (id uuid, full_name text, avatar_url text, role text, room_number text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.full_name, u.avatar_url, u.role::text, u.room_number
  from public.users u
  join public.users me on me.id = auth.uid()
  where me.moved_out_at is null
    and me.floor_number is not null
    and u.floor_number = me.floor_number
    and u.moved_out_at is null
    and coalesce((select state from public.feature_flags where key = 'floor_group_chat'), 'hidden') <> 'hidden'
  order by u.room_number nulls last, u.full_name nulls last;
$$;

revoke all on function public.floor_group_profiles() from public;
grant execute on function public.floor_group_profiles() to authenticated;

-- ヘッダーのトーク未読バッジにもフロアグループを含める。
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
  ) or (
    coalesce((select state from public.feature_flags where key = 'floor_group_chat'), 'hidden') <> 'hidden'
    and exists (
      select 1
      from public.users me
      join public.floor_messages fm on fm.floor_number = me.floor_number
      left join public.floor_message_reads fr on fr.user_id = me.id and fr.floor_number = me.floor_number
      where me.id = auth.uid() and me.moved_out_at is null
        and fm.sender_id <> auth.uid()
        and fm.created_at > coalesce(fr.last_read_at, 'epoch'::timestamptz)
    )
  );
$$;

revoke all on function public.has_unread_talks() from public;
grant execute on function public.has_unread_talks() to authenticated;
