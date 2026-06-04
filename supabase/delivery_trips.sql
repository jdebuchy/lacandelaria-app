do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'delivery_trip_status'
  ) then
    create type public.delivery_trip_status as enum (
      'draft',
      'assigned',
      'in_route',
      'completed',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.delivery_trips (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null,
  driver_user_id uuid references public.profiles(id) on delete set null,
  status public.delivery_trip_status not null default 'draft',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_trip_orders (
  id uuid primary key default gen_random_uuid(),
  delivery_trip_id uuid not null references public.delivery_trips(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  sequence_number integer not null,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_order_id_idx on public.deliveries(order_id);
create index if not exists delivery_trips_scheduled_date_status_idx
  on public.delivery_trips(scheduled_date, status, created_at desc);
create index if not exists delivery_trips_driver_status_idx
  on public.delivery_trips(driver_user_id, status, scheduled_date);
create index if not exists delivery_trip_orders_trip_sequence_idx
  on public.delivery_trip_orders(delivery_trip_id, sequence_number);
create unique index if not exists delivery_trip_orders_active_order_idx
  on public.delivery_trip_orders(order_id)
  where released_at is null;
