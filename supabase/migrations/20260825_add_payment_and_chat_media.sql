-- 手動集金管理・トーク画像・未読通知の追加（最小権限設計）

alter table public.events
  add column if not exists payment_due_at timestamptz,
  add column if not exists payment_destination text;

-- 既存の申込情報とは分離し、RAが集金確認だけを管理する。
create table if not exists public.registration_payments (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  confirmed_at timestamptz,
  confirmed_by uuid references public.users(id),
  note text,
  updated_at timestamptz not null default now()
);
alter table public.registration_payments enable row level security;
create policy "registration_payments_select_own_or_ra" on public.registration_payments for select using (
  public.is_ra() or exists (select 1 from public.registrations r where r.id = registration_id and r.user_id = auth.uid())
);
create policy "registration_payments_manage_ra" on public.registration_payments for all using (public.is_ra()) with check (public.is_ra());

alter table public.event_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path text,
  add column if not exists action_url text,
  add column if not exists action_label text;
alter table public.event_messages drop constraint if exists event_messages_type_check;
alter table public.event_messages add constraint event_messages_type_check check (message_type in ('text', 'image', 'tool'));

create table if not exists public.event_chat_reads (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_chat_reads enable row level security;
create policy "event_chat_reads_select_own" on public.event_chat_reads for select using (user_id = auth.uid());
create policy "event_chat_reads_insert_own" on public.event_chat_reads for insert with check (user_id = auth.uid());
create policy "event_chat_reads_update_own" on public.event_chat_reads for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- トーク画像は非公開。参加者・RAだけが読み書きできる。
insert into storage.buckets (id, name, public) values ('event-chat-media', 'event-chat-media', false) on conflict (id) do nothing;
create policy "chat_media_select_members" on storage.objects for select using (
  bucket_id = 'event-chat-media' and public.can_access_event_talk((storage.foldername(name))[1]::uuid)
);
create policy "chat_media_insert_members" on storage.objects for insert with check (
  bucket_id = 'event-chat-media' and public.can_access_event_talk((storage.foldername(name))[1]::uuid)
);
