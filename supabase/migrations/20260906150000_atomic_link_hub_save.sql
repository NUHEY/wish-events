-- Replace a caller's page and its links in one transaction. A failed insert must
-- never leave the page empty. Existing table policies and ownership are unchanged.
create or replace function public.save_ra_link_hub(
  p_slug text, p_title text, p_bio text, p_published boolean, p_items jsonb
) returns table(id uuid, slug text)
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_slug text := lower(btrim(p_slug));
  v_title text := btrim(p_title);
  v_bio text := nullif(btrim(p_bio), '');
  v_item jsonb;
  v_position integer := 0;
begin
  if not public.has_management_permission('links') then
    raise exception 'Link management permission required' using errcode = '42501';
  end if;
  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$'
    or v_title is null or char_length(v_title) not between 1 and 60
    or char_length(v_bio) > 240 or p_published is null then
    raise exception 'Invalid page details' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Links must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'At most 30 links are allowed' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item->'title') is distinct from 'string'
      or char_length(btrim(v_item->>'title')) not between 1 and 60
      or jsonb_typeof(v_item->'url') is distinct from 'string'
      or char_length(btrim(v_item->>'url')) not between 8 and 1000
      or btrim(v_item->>'url') !~* '^https?://[^[:space:]/?#]+'
      or btrim(v_item->>'url') ~ '[[:space:]]'
      or (v_item ? 'description' and jsonb_typeof(v_item->'description') not in ('string', 'null'))
      or char_length(btrim(v_item->>'description')) > 120
      or jsonb_typeof(v_item->'icon') is distinct from 'string'
      or v_item->>'icon' not in ('link', 'form', 'instagram', 'document', 'calendar', 'contact')
      or jsonb_typeof(v_item->'enabled') is distinct from 'boolean' then
      raise exception 'Invalid link details' using errcode = '22023';
    end if;
  end loop;

  -- The unique owner row also serializes concurrent saves of the same page.
  insert into public.ra_link_hubs as h(owner_id, slug, title, bio, is_published)
  values(auth.uid(), v_slug, v_title, v_bio, p_published)
  on conflict(owner_id) do update set slug = excluded.slug, title = excluded.title,
    bio = excluded.bio, is_published = excluded.is_published, updated_at = now()
  returning h.id into v_id;
  delete from public.ra_link_items where hub_id = v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.ra_link_items(hub_id, title, url, description, icon, position, is_enabled)
    values(v_id, btrim(v_item->>'title'), btrim(v_item->>'url'), nullif(btrim(v_item->>'description'), ''),
      v_item->>'icon', v_position, (v_item->>'enabled')::boolean);
    v_position := v_position + 1;
  end loop;
  return query select v_id, v_slug;
end;
$$;
revoke all on function public.save_ra_link_hub(text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.save_ra_link_hub(text, text, text, boolean, jsonb) to authenticated;
