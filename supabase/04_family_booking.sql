begin;

create or replace function public.register_and_book_family(
  p_parent_name text,
  p_phone_number text,
  p_session_id uuid,
  p_nicknames text[],
  p_age_bands text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_id uuid;
  v_child_ids uuid[] := array[]::uuid[];
  v_count integer;
  i integer;
begin
  v_count := cardinality(p_nicknames);

  if v_count is null or v_count < 1 or v_count > 2 then
    raise exception 'Enter one or two children.';
  end if;

  if cardinality(p_age_bands) is distinct from v_count then
    raise exception 'Select an age band for every child.';
  end if;

  if p_parent_name is null
    or length(trim(p_parent_name)) not between 1 and 80
  then
    raise exception 'Enter a parent name of up to 80 characters.';
  end if;

  if p_phone_number is null
    or p_phone_number !~ '^[+]254[17][0-9]{8}$'
  then
    raise exception 'Enter a valid Kenyan mobile number.';
  end if;

  -- This first version creates new families only.
  -- Existing families will use verified access in a later checkpoint.
  insert into public.families (parent_name, phone_number)
  values (trim(p_parent_name), p_phone_number)
  returning id into v_family_id;

  for i in 1..v_count loop
    if p_nicknames[i] is null
      or length(trim(p_nicknames[i])) not between 1 and 40
    then
      raise exception 'Enter a nickname for every child.';
    end if;

    if p_age_bands[i] is null
      or p_age_bands[i] not in ('3-5', '6-8', '9-12')
    then
      raise exception 'Select a valid age band.';
    end if;

    insert into public.children (family_id, nickname, age_band)
    values (
      v_family_id,
      trim(p_nicknames[i]),
      p_age_bands[i]
    )
    returning id into v_child_id;

    v_child_ids := array_append(v_child_ids, v_child_id);
  end loop;

  -- If booking fails, the family and children inserts also roll back.
  return public.book_family_activity(
    v_family_id,
    p_session_id,
    v_child_ids
  );
end;
$$;

revoke all on function public.register_and_book_family(
  text, text, uuid, text[], text[]
) from public, anon, authenticated;

grant execute on function public.register_and_book_family(
  text, text, uuid, text[], text[]
) to service_role;

commit;
