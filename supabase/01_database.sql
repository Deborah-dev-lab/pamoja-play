-- Pamoja Play: database tables and sample activities.
begin;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text not null,
  timezone text not null default 'Africa/Nairobi',
  organiser_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null
    check (length(trim(parent_name)) between 1 and 80),
  phone_number text not null unique
    check (phone_number ~ '^[+][1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  nickname text not null
    check (length(trim(nickname)) between 1 and 40),
  age_band text not null
    check (age_band in ('3-5', '6-8', '9-12')),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  title text not null,
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  eligible_age_bands text[] not null,
  is_open boolean not null default true,
  check (ends_at > starts_at),
  check (cardinality(eligible_age_bands) > 0),
  check (
    eligible_age_bands <@ array['3-5', '6-8', '9-12']::text[]
  )
);

-- One booking represents a family group in one activity session.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  session_id uuid not null references public.activity_sessions(id),
  status text not null check (
    status in (
      'confirmed',
      'waiting',
      'offered',
      'cancelled',
      'expired'
    )
  ),
  offer_expires_at timestamptz,
  created_at timestamptz not null default now(),
  waitlisted_at timestamptz,
  check (
    status <> 'offered' or offer_expires_at is not null
  ),
  check (
    status not in ('waiting', 'offered')
    or waitlisted_at is not null
  ),
  unique (id, family_id)
);

create unique index if not exists bookings_one_active_group
  on public.bookings (family_id, session_id)
  where status in ('confirmed', 'waiting', 'offered');

create index if not exists bookings_queue
  on public.bookings (session_id, waitlisted_at, id)
  where status = 'waiting';

create index if not exists bookings_offer_expiry
  on public.bookings (offer_expires_at)
  where status = 'offered';

-- Every child in a booking must belong to the booking's family.
create table if not exists public.booking_children (
  booking_id uuid not null,
  child_id uuid not null,
  family_id uuid not null,
  primary key (booking_id, child_id),
  foreign key (booking_id, family_id)
    references public.bookings(id, family_id),
  foreign key (child_id, family_id)
    references public.children(id, family_id)
);

-- Store SMS jobs and track their delivery.
create table if not exists public.sms_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  recipient text not null
    check (recipient ~ '^[+][1-9][0-9]{7,14}$'),
  message text not null,
  deduplication_key text not null unique,
  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'accepted',
      'delivered',
      'failed'
    )
  ),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now()
);

-- Restrict access. Backend access will be configured next.
alter table public.events enable row level security;
alter table public.families enable row level security;
alter table public.children enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_children enable row level security;
alter table public.sms_jobs enable row level security;

revoke all on
  public.events,
  public.families,
  public.children,
  public.activity_sessions,
  public.bookings,
  public.booking_children,
  public.sms_jobs
from anon, authenticated;

grant all on
  public.events,
  public.families,
  public.children,
  public.activity_sessions,
  public.bookings,
  public.booking_children,
  public.sms_jobs
to service_role;

-- Fictional demonstration event.
insert into public.events (id, name, venue)
values (
  '10000000-0000-4000-8000-000000000001',
  'Pamoja Family Fun Day',
  'Demo venue, Nairobi'
)
on conflict (id) do nothing;

-- Sample activities with deliberately small capacities for testing.
insert into public.activity_sessions (
  id,
  event_id,
  title,
  location,
  starts_at,
  ends_at,
  capacity,
  eligible_age_bands
)
values
(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Colour Lab',
  'Art Tent',
  '2026-10-17 10:00:00+03',
  '2026-10-17 10:30:00+03',
  2,
  array['3-5', '6-8']
),
(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'Little Inventors',
  'Discovery Tent',
  '2026-10-17 10:00:00+03',
  '2026-10-17 10:45:00+03',
  4,
  array['6-8', '9-12']
),
(
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'Story Safari',
  'Story Corner',
  '2026-10-17 11:00:00+03',
  '2026-10-17 11:30:00+03',
  6,
  array['3-5', '6-8', '9-12']
)
on conflict (id) do nothing;

commit;

-- Display the sample activities.
select
  title,
  capacity,
  eligible_age_bands,
  starts_at at time zone 'Africa/Nairobi' as start_time
from public.activity_sessions
where event_id = '10000000-0000-4000-8000-000000000001'
order by starts_at, title;
