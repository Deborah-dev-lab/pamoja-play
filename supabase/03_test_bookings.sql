begin;

-- Create two fictional families.
insert into public.families (
  id,
  parent_name,
  phone_number
)
values
(
  '30000000-0000-4000-8000-000000000001',
  'Demo Parent A',
  '+254700000001'
),
(
  '30000000-0000-4000-8000-000000000002',
  'Demo Parent B',
  '+254700000002'
);

-- Each family has two children.
insert into public.children (
  id,
  family_id,
  nickname,
  age_band
)
values
(
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Demo Child A1',
  '3-5'
),
(
  '40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  'Demo Child A2',
  '6-8'
),
(
  '40000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000002',
  'Demo Child B1',
  '3-5'
),
(
  '40000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000002',
  'Demo Child B2',
  '6-8'
);

-- Run checks. Any unexpected result raises an error.
do $$
declare
  v_result jsonb;
  v_first_booking_id text;
begin
  -- Family A should take both Colour Lab places.
  v_result := public.book_family_activity(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    array[
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002'
    ]::uuid[]
  );

  if v_result->>'status' <> 'confirmed' then
    raise exception 'TEST FAILED: Family A should be confirmed.';
  end if;

  v_first_booking_id := v_result->>'booking_id';

  -- Repeating the request must return the same booking.
  v_result := public.book_family_activity(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    array[
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002'
    ]::uuid[]
  );

  if v_result->>'booking_id' <> v_first_booking_id
    or v_result->>'existing' <> 'true'
  then
    raise exception 'TEST FAILED: Duplicate request was not handled.';
  end if;

  -- Family B must wait because the session is full.
  v_result := public.book_family_activity(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    array[
      '40000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000004'
    ]::uuid[]
  );

  if v_result->>'status' <> 'waiting' then
    raise exception 'TEST FAILED: Family B should be waiting.';
  end if;
end;
$$;

-- Display the two group bookings.
select
  f.parent_name,
  s.title,
  b.status,
  count(bc.child_id) as children_in_booking
from public.bookings b
join public.families f
  on f.id = b.family_id
join public.activity_sessions s
  on s.id = b.session_id
join public.booking_children bc
  on bc.booking_id = b.id
where f.id in (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002'
)
group by f.parent_name, s.title, b.id, b.status
order by f.parent_name;

-- Remove all test data while keeping the tables and function.
rollback;
