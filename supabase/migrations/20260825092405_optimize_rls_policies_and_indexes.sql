
-- ---------------------------------------------------------------------
-- パフォーマンス最適化: RLSポリシーのauth.uid()呼び出しを (select auth.uid())
-- でラップし、行ごとの再評価を防ぐ（Supabaseのperformance advisorで
-- auth_rls_initplan警告が出ていた35件すべてに対応）。
-- 参照: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ---------------------------------------------------------------------

alter policy "users_select_own" on public.users
  using (id = (select auth.uid()));
alter policy "users_insert_own" on public.users
  with check (id = (select auth.uid()));
alter policy "users_update_own" on public.users
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "events_insert_ra" on public.events
  with check (public.is_ra() and created_by = (select auth.uid()));

alter policy "registrations_insert_own" on public.registrations
  with check (user_id = (select auth.uid()));

alter policy "surveys_insert_ra" on public.surveys
  with check (public.is_ra() and created_by = (select auth.uid()));

alter policy "survey_responses_insert_own" on public.survey_responses
  with check (user_id = (select auth.uid()));

alter policy "survey_answers_select_own" on public.survey_answers
  using (exists (select 1 from public.survey_responses r where r.id = survey_answers.response_id and r.user_id = (select auth.uid())));
alter policy "survey_answers_insert_own" on public.survey_answers
  with check (exists (select 1 from public.survey_responses r where r.id = survey_answers.response_id and r.user_id = (select auth.uid())));

alter policy "event_comments_select_authenticated" on public.event_comments
  using ((select auth.uid()) is not null);
alter policy "event_comments_insert_own" on public.event_comments
  with check (user_id = (select auth.uid()));
alter policy "event_comments_update_own" on public.event_comments
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "event_comments_delete_own" on public.event_comments
  using (user_id = (select auth.uid()));

alter policy "event_comment_likes_select_authenticated" on public.event_comment_likes
  using ((select auth.uid()) is not null);
alter policy "event_comment_likes_insert_own" on public.event_comment_likes
  with check (user_id = (select auth.uid()));
alter policy "event_comment_likes_delete_own" on public.event_comment_likes
  using (user_id = (select auth.uid()));

alter policy "announcements_insert_ra" on public.announcements
  with check (public.is_ra() and created_by = (select auth.uid()));

alter policy "registration_answers_select" on public.registration_answers
  using (public.is_ra() or exists (select 1 from public.registrations r where r.id = registration_answers.registration_id and r.user_id = (select auth.uid())));
alter policy "registration_answers_insert_own" on public.registration_answers
  with check (exists (select 1 from public.registrations r where r.id = registration_answers.registration_id and r.user_id = (select auth.uid())));

alter policy "events_select" on public.events
  using (
    public.is_ra()
    or (
      (publish_at is null or publish_at <= now())
      and (target_floors is null or array_length(target_floors, 1) is null or public.current_user_floor() = any(target_floors))
    )
    or exists (select 1 from public.registrations r where r.event_id = events.id and r.user_id = (select auth.uid()))
  );

alter policy "event_messages_insert_members" on public.event_messages
  with check (sender_id = (select auth.uid()) and public.can_access_event_talk(event_id));

alter policy "event_likes_select_authenticated" on public.event_likes
  using ((select auth.uid()) is not null);
alter policy "event_likes_insert_own" on public.event_likes
  with check (user_id = (select auth.uid()));
alter policy "event_likes_delete_own" on public.event_likes
  using (user_id = (select auth.uid()));

alter policy "event_chat_reads_select_own" on public.event_chat_reads
  using (user_id = (select auth.uid()));
alter policy "event_chat_reads_insert_own" on public.event_chat_reads
  with check (user_id = (select auth.uid()));
alter policy "event_chat_reads_update_own" on public.event_chat_reads
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "event_message_reactions_insert_own" on public.event_message_reactions
  with check (user_id = (select auth.uid()) and exists (select 1 from public.event_messages m where m.id = event_message_reactions.message_id and public.can_access_event_talk(m.event_id)));
alter policy "event_message_reactions_delete_own" on public.event_message_reactions
  using (user_id = (select auth.uid()));

alter policy "event_poll_votes_insert_own" on public.event_poll_votes
  with check (user_id = (select auth.uid()) and exists (select 1 from public.event_polls p where p.id = event_poll_votes.poll_id and public.can_access_event_talk(p.event_id)));
alter policy "event_poll_votes_update_own" on public.event_poll_votes
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "registration_payments_select_own_or_ra" on public.registration_payments
  using (exists (select 1 from public.registrations r where r.id = registration_payments.registration_id and r.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- multiple_permissive_policies警告の解消: 「RAは全件」「本人は自分の分だけ」
-- という2つのポリシーが同じ操作に対して両方評価されていたテーブルを、
-- 1つの結合ポリシーにまとめる（実質的な権限は変更しない）。
-- ---------------------------------------------------------------------

drop policy if exists "registrations_select_any_ra" on public.registrations;
drop policy if exists "registrations_select_own" on public.registrations;
create policy "registrations_select" on public.registrations
for select using (public.is_ra() or user_id = (select auth.uid()));

drop policy if exists "registrations_delete_any_ra" on public.registrations;
drop policy if exists "registrations_delete_own" on public.registrations;
create policy "registrations_delete" on public.registrations
for delete using (public.is_ra() or user_id = (select auth.uid()));

drop policy if exists "survey_answers_select_any_ra" on public.survey_answers;
drop policy if exists "survey_answers_select_own" on public.survey_answers;
create policy "survey_answers_select" on public.survey_answers
for select using (public.is_ra() or exists (select 1 from public.survey_responses r where r.id = survey_answers.response_id and r.user_id = (select auth.uid())));

drop policy if exists "survey_responses_select_any_ra" on public.survey_responses;
drop policy if exists "survey_responses_select_own" on public.survey_responses;
create policy "survey_responses_select" on public.survey_responses
for select using (public.is_ra() or user_id = (select auth.uid()));

drop policy if exists "users_select_all_for_ra" on public.users;
drop policy if exists "users_select_own" on public.users;
create policy "users_select" on public.users
for select using (public.is_ra() or id = (select auth.uid()));

-- survey_questions_manage_ra（ALL, RAは全操作可）と survey_questions_select
-- は、RA分岐が重複していたのでselect側から取り除く（RAはmanage_ra側で
-- 引き続きselectできる）。
drop policy if exists "survey_questions_select" on public.survey_questions;
create policy "survey_questions_select" on public.survey_questions
for select using (exists (select 1 from public.surveys s where s.id = survey_questions.survey_id and s.is_active));

-- registration_payments_manage_ra（ALL, RAは全操作可）と
-- registration_payments_select_own_or_ra も同様にRA分岐の重複を解消済み
-- （上のALTER POLICYでis_ra() ORを取り除いている）。

-- ---------------------------------------------------------------------
-- 未インデックスの外部キー17件にカバーインデックスを追加
-- （JOINやON DELETE CASCADEのパフォーマンス向上）。
-- ---------------------------------------------------------------------
create index if not exists announcements_created_by_idx on public.announcements(created_by);
create index if not exists event_chat_reads_user_id_idx on public.event_chat_reads(user_id);
create index if not exists event_comment_likes_user_id_idx on public.event_comment_likes(user_id);
create index if not exists event_comments_parent_id_idx on public.event_comments(parent_id);
create index if not exists event_comments_user_id_idx on public.event_comments(user_id);
create index if not exists event_likes_user_id_idx on public.event_likes(user_id);
create index if not exists event_message_reactions_user_id_idx on public.event_message_reactions(user_id);
create index if not exists event_messages_poll_id_idx on public.event_messages(poll_id);
create index if not exists event_messages_sender_id_idx on public.event_messages(sender_id);
create index if not exists event_poll_votes_user_id_idx on public.event_poll_votes(user_id);
create index if not exists event_polls_created_by_idx on public.event_polls(created_by);
create index if not exists ra_rooms_created_by_idx on public.ra_rooms(created_by);
create index if not exists registration_answers_question_id_idx on public.registration_answers(question_id);
create index if not exists registration_payments_confirmed_by_idx on public.registration_payments(confirmed_by);
create index if not exists survey_answers_question_id_idx on public.survey_answers(question_id);
create index if not exists survey_responses_user_id_idx on public.survey_responses(user_id);
create index if not exists surveys_created_by_idx on public.surveys(created_by);

-- ---------------------------------------------------------------------
-- セキュリティ: event_community_profiles系関数がanon(未ログイン)からも
-- 実行可能になっていたのを是正。他のRPC同様、authenticatedのみに限定する。
-- 併せて、コード側で参照されなくなった無印版(v3以前の中間バージョン)は削除する。
-- ---------------------------------------------------------------------
revoke execute on function public.can_access_event_talk(uuid) from anon;
revoke execute on function public.event_community_profiles_v3(uuid[]) from anon;

drop function if exists public.event_community_profiles(uuid[]);
