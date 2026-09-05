-- A schedule's participant/booking meaning is fixed at creation. Prevent owner
-- UPDATE policies from turning a resident-created schedule into an RA-only tool.
create or replace function public.preserve_schedule_structure()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.share_token is distinct from old.share_token
    or new.created_by is distinct from old.created_by
    or new.kind is distinct from old.kind
    or new.floor_number is distinct from old.floor_number
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.daily_start_time is distinct from old.daily_start_time
    or new.daily_end_time is distinct from old.daily_end_time
    or new.slot_minutes is distinct from old.slot_minutes
    or new.created_at is distinct from old.created_at then
    raise exception 'Schedule structure cannot be changed after creation' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_schedule_structure() from public, anon, authenticated;
drop trigger if exists preserve_schedule_structure on public.schedule_sessions;
create trigger preserve_schedule_structure before update on public.schedule_sessions
for each row execute function public.preserve_schedule_structure();
