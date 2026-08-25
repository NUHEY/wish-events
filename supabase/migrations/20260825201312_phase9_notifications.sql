create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  type text not null check (type in (
    'friend_request', 'friend_accept',
    'event_like', 'event_comment', 'event_comment_reply', 'event_comment_like',
    'announcement_comment', 'announcement_comment_reply', 'announcement_comment_like'
  )),
  link text not null,
  preview_text text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Instagram風の通知フィード用。直接INSERTは許可せず、各種アクション（友達申請/承認、いいね、コメント、返信）のトリガー関数からのみ生成される。';

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
on public.notifications for select using (user_id = auth.uid());
create policy "notifications_update_own"
on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own"
on public.notifications for delete using (user_id = auth.uid());
-- insertポリシーは設けない: 通知の生成は下記のSECURITY DEFINERトリガー関数のみが行う
-- （クライアントから偽の通知を直接INSERTできないようにするため）。

-- ---------------------------------------------------------------------
-- 友達申請・承認
-- ---------------------------------------------------------------------
create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, link)
  values (new.addressee_id, new.requester_id, 'friend_request', '/directory/' || new.requester_id);
  return new;
end;
$$;

create trigger trg_notify_friend_request
after insert on public.friend_requests
for each row execute function public.notify_friend_request();

create or replace function public.notify_friend_accept()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, actor_id, type, link)
    values (new.requester_id, new.addressee_id, 'friend_accept', '/directory/' || new.addressee_id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_friend_accept
after update on public.friend_requests
for each row execute function public.notify_friend_accept();

-- ---------------------------------------------------------------------
-- イベントへのいいね・コメント・コメントへのいいね
-- ---------------------------------------------------------------------
create or replace function public.notify_event_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  select created_by into v_owner from public.events where id = new.event_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, link)
    values (v_owner, new.user_id, 'event_like', '/events/' || new.event_id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_event_like
after insert on public.event_likes
for each row execute function public.notify_event_like();

create or replace function public.notify_event_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_parent_user uuid;
begin
  if new.parent_id is null then
    select created_by into v_owner from public.events where id = new.event_id;
    if v_owner is not null and v_owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, link, preview_text)
      values (v_owner, new.user_id, 'event_comment', '/events/' || new.event_id, left(new.body, 140));
    end if;
  else
    select user_id into v_parent_user from public.event_comments where id = new.parent_id;
    if v_parent_user is not null and v_parent_user <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, link, preview_text)
      values (v_parent_user, new.user_id, 'event_comment_reply', '/events/' || new.event_id, left(new.body, 140));
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notify_event_comment
after insert on public.event_comments
for each row execute function public.notify_event_comment();

create or replace function public.notify_event_comment_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_author uuid;
  v_event_id uuid;
begin
  select user_id, event_id into v_author, v_event_id from public.event_comments where id = new.comment_id;
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, link)
    values (v_author, new.user_id, 'event_comment_like', '/events/' || v_event_id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_event_comment_like
after insert on public.event_comment_likes
for each row execute function public.notify_event_comment_like();

-- ---------------------------------------------------------------------
-- お知らせへのコメント・コメントへのいいね
-- ---------------------------------------------------------------------
create or replace function public.notify_announcement_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_parent_user uuid;
begin
  if new.parent_id is null then
    select created_by into v_owner from public.announcements where id = new.announcement_id;
    if v_owner is not null and v_owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, link, preview_text)
      values (v_owner, new.user_id, 'announcement_comment', '/announcements/' || new.announcement_id, left(new.body, 140));
    end if;
  else
    select user_id into v_parent_user from public.announcement_comments where id = new.parent_id;
    if v_parent_user is not null and v_parent_user <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, link, preview_text)
      values (v_parent_user, new.user_id, 'announcement_comment_reply', '/announcements/' || new.announcement_id, left(new.body, 140));
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notify_announcement_comment
after insert on public.announcement_comments
for each row execute function public.notify_announcement_comment();

create or replace function public.notify_announcement_comment_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_author uuid;
  v_announcement_id uuid;
begin
  select user_id, announcement_id into v_author, v_announcement_id
    from public.announcement_comments where id = new.comment_id;
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, link)
    values (v_author, new.user_id, 'announcement_comment_like', '/announcements/' || v_announcement_id);
  end if;
  return new;
end;
$$;

create trigger trg_notify_announcement_comment_like
after insert on public.announcement_comment_likes
for each row execute function public.notify_announcement_comment_like();

-- ---------------------------------------------------------------------
-- ヘッダーの通知ボタンの赤い未読ドット表示用（has_unread_talks等と同じ設計）
-- ---------------------------------------------------------------------
create or replace function public.has_unread_notifications()
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.notifications where user_id = auth.uid() and read_at is null);
$$;

revoke all on function public.has_unread_notifications() from public;
revoke execute on function public.has_unread_notifications() from anon;
grant execute on function public.has_unread_notifications() to authenticated;

-- notify_*関数はトリガーからのみ発火されるべきで、直接RPCとして呼び出す必要はない。
-- security advisorの「anon/authenticatedがSECURITY DEFINER関数を実行可能」という
-- 警告を解消するため、全ロールからEXECUTE権限を剥奪する
-- （トリガー自体は発火時にEXECUTE権限を再チェックしないため、これで発火は妨げられない）。
revoke all on function public.notify_friend_request() from public, anon, authenticated;
revoke all on function public.notify_friend_accept() from public, anon, authenticated;
revoke all on function public.notify_event_like() from public, anon, authenticated;
revoke all on function public.notify_event_comment() from public, anon, authenticated;
revoke all on function public.notify_event_comment_like() from public, anon, authenticated;
revoke all on function public.notify_announcement_comment() from public, anon, authenticated;
revoke all on function public.notify_announcement_comment_like() from public, anon, authenticated;
