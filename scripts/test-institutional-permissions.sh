#!/usr/bin/env bash
# Starts and destroys a separate PostgreSQL cluster. Never connects to an existing service.
set -euo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
pg_bin=${PG_TEST_BIN:-$(pg_config --bindir)}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/wish-security.XXXXXX")
cleanup() {
  "$pg_bin/pg_ctl" -D "$test_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$test_dir"
}
trap cleanup EXIT
mkdir "$test_dir/socket"
"$pg_bin/initdb" -D "$test_dir/data" -A trust --no-locale -E UTF8 >"$test_dir/init.log" 2>&1 || {
  cat "$test_dir/init.log"
  exit 1
}
"$pg_bin/pg_ctl" -D "$test_dir/data" -l "$test_dir/server.log" -o "-c listen_addresses='' -c unix_socket_directories='$test_dir/socket'" -w start
"$pg_bin/createdb" -h "$test_dir/socket" wish_events_security_test
python3 - "$repo_dir" "$test_dir/resync.sql" <<'PY'
from pathlib import Path
import sys
source = (Path(sys.argv[1]) / 'supabase/schema.sql').read_text()
start = source.index('create or replace function public.resync_room_role(')
end_marker = 'grant execute on function public.resync_room_role(integer, text) to authenticated;'
end = source.index(end_marker, start) + len(end_marker)
Path(sys.argv[2]).write_text(source[start:end] + '\n')
PY
"$pg_bin/psql" -X -h "$test_dir/socket" -d wish_events_security_test \
  -v ON_ERROR_STOP=1 -v resync_function_file="$test_dir/resync.sql" \
  -f "$repo_dir/tests/sql/account-security.sql"

python3 - "$repo_dir" "$test_dir/active-functions.sql" <<'PYSQL'
from pathlib import Path
import sys,re
source=(Path(sys.argv[1])/'supabase/schema.sql').read_text()
functions=[]
for name in ('can_access_event_talk','event_community_profiles_v3'):
 match=re.search(r'create or replace function public\.'+name+r'\([\s\S]*?\$\$;',source,re.I)
 if not match: raise RuntimeError(name)
 functions.append(match.group())
Path(sys.argv[2]).write_text('\n'.join(functions))
PYSQL
"$pg_bin/psql" -X -h "$test_dir/socket" -d wish_events_security_test \
  -v ON_ERROR_STOP=1 -v active_functions_file="$test_dir/active-functions.sql" \
  -f "$repo_dir/tests/sql/active-account-security.sql"

# Test the installed source definitions, then patch them with the new migration.
python3 - "$repo_dir" "$test_dir/management-definitions.sql" <<'PYMANAGEMENT'
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
methods={
 'supabase/migrations/20260828160000_fix_resident_event_save_and_home_section.sql':['create_resident_event'],
 'supabase/migrations/20260827_add_resident_beta_tools.sql':['set_new_resident_status','beta_feature_enabled','schedule_feature_key'],
 'supabase/migrations/20260827_enforce_event_registration_and_entry_month.sql':['is_current_new_resident','can_access_schedule_session','replace_registration_questions'],
 'supabase/migrations/20260828_schedule_home_tools_and_survey_results.sql':['create_schedule_session','set_schedule_status','delete_schedule_session','set_lets_chat_completed','save_event_survey'],
 'supabase/migrations/20260827_add_notification_senders_and_calendar_flag.sql':['send_ra_broadcast_notification'],
}
parts=['set check_function_bodies = false;']
for path,names in methods.items():
 source=(root/path).read_text()
 for name in names:
  found=re.search(r'create (?:or replace )?function public\.'+name+r'\([\s\S]*?\$\$;',source,re.I)
  if not found: raise RuntimeError(name)
  parts.append(found.group())
parts.append('set check_function_bodies = true;')
policies={
 'supabase/migrations/20260827_add_resident_beta_tools.sql':['schedule_sessions_select_accessible','schedule_sessions_update_owner','schedule_sessions_delete_owner','schedule_participants_select_accessible','schedule_participants_manage_owner'],
 'supabase/migrations/20260828_schedule_home_tools_and_survey_results.sql':['schedule_sessions_insert_enabled'],
 'supabase/schema.sql':['events_insert_ra','events_update_any_ra','events_delete_any_ra','announcements_select_all','announcements_insert_ra','announcements_update_any_ra','announcements_delete_any_ra','poster_public_select','poster_ra_insert','poster_ra_update','poster_ra_delete'],
 'supabase/migrations/20260826_add_site_settings.sql':['site_settings_select_all','site_settings_update_ra','site_assets_select_public','site_assets_write_ra','site_assets_update_ra','site_assets_delete_ra'],
 'supabase/migrations/20260826_add_feature_flags.sql':['feature_flags_select_authenticated','feature_flags_insert_ra','feature_flags_update_ra'],
}
for path,names in policies.items():
 source=(root/path).read_text()
 for name in names:
  found=re.search(r'create policy "'+name+r'"[\s\S]*?;',source,re.I)
  if not found: raise RuntimeError(name)
  parts.append(found.group())
parts.append('create policy fixture_managers_select on public.events for select using(public.is_ra());')
# Simulate existing authenticated RPC grants; migration must preserve them.
for names in methods.values():
 for name in names:
  parts.append("do $$ declare f record; begin for f in select oid::regprocedure sig from pg_proc where proname='"+name+"' and pronamespace='public'::regnamespace loop execute 'revoke all on function '||f.sig||' from public'; execute 'grant execute on function '||f.sig||' to authenticated'; end loop; end $$;")
parts.append('revoke execute on function public.set_new_resident_status(uuid,boolean) from authenticated;')
Path(sys.argv[2]).write_text('\n'.join(parts))
PYMANAGEMENT
"$pg_bin/psql" -X -h "$test_dir/socket" -d wish_events_security_test \
  -v ON_ERROR_STOP=1 -v management_definitions_file="$test_dir/management-definitions.sql" \
  -f "$repo_dir/tests/sql/institutional-permissions-security.sql"
