-- Change only link validation; retain the existing active-account and delegated
-- management checks, sender handling, and broadcast deduplication unchanged.
do $migration$
declare
  fn regprocedure := 'public.send_ra_broadcast_notification(uuid[],text,text,uuid,text,text)'::regprocedure;
  definition text;
  old_check text := $old$if p_link is null or p_link !~ '^/' or char_length(p_link) > 500 then$old$;
  new_check text := $new$-- WISH external notification links v1
  if p_link is null or char_length(p_link) > 500 or p_link ~ '[[:space:]]' or position(chr(92) in p_link) > 0
    or not (p_link ~ '^/([^/]|$)' or p_link ~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$') then$new$;
begin
  definition := pg_get_functiondef(fn);
  if position('-- WISH external notification links v1' in definition) > 0 then return; end if;
  if position(old_check in definition) = 0 then raise exception 'Unexpected notification validation definition'; end if;
  definition := replace(definition, old_check, new_check);
  definition := replace(definition, 'リンクはサイト内のパスで指定してください', 'リンクはサイト内のパスまたはHTTP(S)のURLで指定してください');
  execute definition;
end;
$migration$;
