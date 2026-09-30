begin;

create or replace function public.book_family_activity(
  p_family_id uuid,
  p_session_id uuid,
  p_child_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.activity_sessions%rowtype;
  v_existing public.bookings%rowtype;
  v_child_count integer;
  v_valid_count integer;
  v_used_places integer;
  v_booking_id uuid;
  v_status text;
  v_requested_children uuid[];
  v_existing_children uuid[];
begin
  -- Accept one or two different children.
  if p_child_ids is null then
    raise exception 'Please select at least one child.';
  end if;

  v_child_count := cardinality(p_child_ids);

  if v_child_count < 1 or v_child_count > 2 then
    raise exception 'Select one or two children.';
  end if;

  select array_agg(distinct child_id order by child_id)
  into v_requested_children
  from unnest(p_child_ids) as selected(child_id)
  where child_id is not null;

  if cardinality(v_requested_children) is distinct from v_child_count then
    raise exception 'Select each child only once.';
  end if;

  -- Serialise this family's bookings to prevent timetable clashes
  -- when two requests arrive at the same time.
  perform id
  from public.families
  where id = p_family_id
  for update;

  if not found then
    raise exception 'Family not found.';
  end if;

  -- Lock the session so simultaneous requests cannot overbook it.
  select *
  into v_session
  from public.activity_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Activity not found.';
  end if;

  -- Check that every selected child belongs to this family.
  select count(*)
  into v_valid_count
  from public.children
  where family_id = p_family_id
    and id = any(v_requested_children);

  if v_valid_count <> v_child_count then
    raise exception 'A selected child does not belong to this family.';
  end if;

  -- Repeated requests return the existing booking.
  select *
  into v_existing
  from public.bookings
  where family_id = p_family_id
    and session_id = p_session_id
    and status in ('confirmed', 'waiting', 'offered');

  if found then
    select array_agg(child_id order by child_id)
    into v_existing_children
    from public.booking_children
    where booking_id = v_existing.id;

    if v_existing_children is distinct from v_requested_children then
      raise exception
        'Your family already has a booking for this activity with different children.';
    end if;

    return jsonb_build_object(
      'booking_id', v_existing.id,
      'status', v_existing.status,
      'children', v_child_count,
      'existing', true
    );
  end if;

  if not v_session.is_open then
    raise exception 'Bookings are closed for this activity.';
  end if;

  if v_session.starts_at <= now() then
    raise exception 'This activity has already started.';
  end if;

  -- A group must fit within the activity's total capacity.
  if v_child_count > v_session.capacity then
    raise exception 'This activity cannot accommodate the whole group.';
  end if;

  -- All selected children must meet the age requirements.
  if exists (
    select 1
    from public.children
    where id = any(v_requested_children)
      and not (
        age_band = any(v_session.eligible_age_bands)
      )
  ) then
    raise exception
      'This activity is not suitable for every selected child.';
  end if;

  -- Prevent overlaps with confirmed places or reserved offers.
  if exists (
    select 1
    from public.booking_children bc
    join public.bookings b
      on b.id = bc.booking_id
    join public.activity_sessions s
      on s.id = b.session_id
    where bc.child_id = any(v_requested_children)
      and b.status in ('confirmed', 'offered')
      and s.starts_at < v_session.ends_at
      and s.ends_at > v_session.starts_at
  ) then
    raise exception
      'A selected child already has an activity at this time.';
  end if;

  -- Each booked child occupies one place.
  -- Offers remain reserved until the expiry workflow releases them.
  select count(*)
  into v_used_places
  from public.booking_children bc
  join public.bookings b
    on b.id = bc.booking_id
  where b.session_id = p_session_id
    and b.status in ('confirmed', 'offered');

  -- Confirm only if the whole group fits and nobody is waiting.
  -- This prevents new arrivals from bypassing the queue.
  if v_used_places + v_child_count <= v_session.capacity
    and not exists (
      select 1
      from public.bookings
      where session_id = p_session_id
        and status = 'waiting'
    )
  then
    v_status := 'confirmed';
  else
    v_status := 'waiting';
  end if;

  insert into public.bookings (
    family_id,
    session_id,
    status,
    waitlisted_at
  )
  values (
    p_family_id,
    p_session_id,
    v_status,
    case
      when v_status = 'waiting' then clock_timestamp()
      else null
    end
  )
  returning id into v_booking_id;

  insert into public.booking_children (
    booking_id,
    child_id,
    family_id
  )
  select
    v_booking_id,
    child_id,
    p_family_id
  from unnest(v_requested_children) as selected(child_id);

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'status', v_status,
    'children', v_child_count,
    'existing', false
  );
end;
$$;

-- Only the trusted backend may call this function.
revoke all on function public.book_family_activity(
  uuid, uuid, uuid[]
) from public, anon, authenticated;

grant execute on function public.book_family_activity(
  uuid, uuid, uuid[]
) to service_role;

commit;
