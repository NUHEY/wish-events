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
