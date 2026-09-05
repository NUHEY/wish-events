-- Announcement covers already use announcements/<uuid> in event-posters.
-- Delegating announcement publication permits creating these covers only;
-- existing event poster update/delete permissions stay unchanged.
begin;
drop policy if exists announcement_covers_insert_delegated on storage.objects;
create policy announcement_covers_insert_delegated on storage.objects
for insert to authenticated
with check (
  bucket_id = 'event-posters'
  and split_part(name, '/', 1) = 'announcements'
  and public.has_management_permission('announcements')
);
notify pgrst, 'reload schema';
commit;
