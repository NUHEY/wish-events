-- コメント削除機能: 本人に加えてRAもモデレーション目的で削除できるようにする。
drop policy if exists "event_comments_delete_own" on public.event_comments;
create policy "event_comments_delete" on public.event_comments
for delete using (user_id = (select auth.uid()) or public.is_ra());
