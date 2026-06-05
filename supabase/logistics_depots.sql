create table if not exists public.logistics_depots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  address_line_1 text not null,
  locality text not null,
  administrative_area_level_1 text not null,
  google_place_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.logistics_depots (
  code,
  label,
  address_line_1,
  locality,
  administrative_area_level_1,
  google_place_id,
  active
)
values (
  'deposito_1',
  'Depósito 1',
  'Juan Antonio Cabrera 4511',
  'Buenos Aires',
  'Capital Federal',
  null,
  true
)
on conflict (code) do update
set
  label = excluded.label,
  address_line_1 = excluded.address_line_1,
  locality = excluded.locality,
  administrative_area_level_1 = excluded.administrative_area_level_1,
  google_place_id = excluded.google_place_id,
  active = excluded.active;

alter table public.delivery_trips
add column if not exists depot_id uuid references public.logistics_depots(id) on delete restrict;

update public.delivery_trips
set depot_id = (
  select id
  from public.logistics_depots
  where code = 'deposito_1'
)
where depot_id is null;

alter table public.delivery_trips
alter column depot_id set not null;

create index if not exists logistics_depots_active_label_idx
  on public.logistics_depots(active, label);

create index if not exists delivery_trips_depot_scheduled_date_idx
  on public.delivery_trips(depot_id, scheduled_date, created_at desc);
