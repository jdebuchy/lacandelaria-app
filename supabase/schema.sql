create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'seller', 'driver', 'collector');
create type public.payment_method as enum ('cash', 'transfer');
create type public.order_status as enum (
  'pending_confirmation',
  'confirmed',
  'assigned',
  'in_route',
  'delivered',
  'cancelled'
);
create type public.payment_status as enum ('pending', 'partial', 'paid');
create type public.sales_channel as enum ('internal', 'public_form', 'reseller');
create type public.public_request_status as enum ('new', 'reviewed', 'converted', 'rejected');
create type public.delivery_status as enum ('pending', 'in_route', 'delivered', 'failed');
create type public.commission_status as enum ('pending', 'liquidated');
create type public.delivery_trip_status as enum ('draft', 'assigned', 'in_route', 'completed', 'cancelled');

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique,
  full_name text not null,
  phone text,
  role public.user_role not null default 'seller',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone text,
  instagram text,
  address_kind text not null default 'standard',
  address_line_1 text,
  address_line_2 text,
  gated_community_name text,
  locality text,
  administrative_area_level_1 text,
  postal_code text,
  google_place_id text,
  google_place_label text,
  address_source text not null default 'manual',
  delivery_area text not null default 'pending_review',
  delivery_notes text,
  source text not null default 'repeat',
  auth_user_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resellers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  neighborhood text,
  zone text,
  commission_rate numeric(5,4) not null default 0.15,
  payout_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  origin text,
  received_at timestamptz not null default now(),
  boxes_received integer not null default 0,
  boxes_available integer not null default 0,
  boxes_reserved integer not null default 0,
  boxes_delivered integer not null default 0,
  boxes_waste integer not null default 0,
  notes text
);

create table if not exists public.product_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  default_variant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_family_id uuid not null references public.product_families(id) on delete cascade,
  label text not null,
  slug text not null unique,
  description text,
  cash_price numeric(12,2) not null,
  transfer_price numeric(12,2) not null,
  active boolean not null default true,
  display_order integer not null default 0,
  visibility text not null default 'sellable' check (visibility in ('sellable', 'internal')),
  composition_type text not null default 'simple' check (composition_type in ('simple', 'bundle')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_families_default_variant_id_fkey'
  ) then
    alter table public.product_families
      add constraint product_families_default_variant_id_fkey
      foreign key (default_variant_id) references public.product_variants(id) on delete set null;
  end if;
end $$;

create table if not exists public.product_variant_components (
  bundle_variant_id uuid not null references public.product_variants(id) on delete cascade,
  component_variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity numeric(12,2) not null,
  created_at timestamptz not null default now(),
  primary key (bundle_variant_id, component_variant_id),
  constraint product_variant_components_no_self_reference
    check (bundle_variant_id <> component_variant_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete restrict,
  seller_user_id uuid references public.profiles(id) on delete set null,
  reseller_id uuid references public.resellers(id) on delete set null,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  sales_channel public.sales_channel not null default 'internal',
  items_count integer not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_method_expected public.payment_method not null,
  is_complimentary boolean not null default false,
  status public.order_status not null default 'pending_confirmation',
  payment_status public.payment_status not null default 'pending',
  delivery_date date,
  delivery_window_start time,
  delivery_window_end time,
  delivery_area text not null default 'pending_review',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.public_order_requests (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone text not null,
  instagram text,
  address_kind text not null default 'standard',
  address_line_1 text,
  address_line_2 text,
  gated_community_name text,
  locality text,
  administrative_area_level_1 text,
  postal_code text,
  google_place_id text,
  google_place_label text,
  address_source text not null default 'manual',
  delivery_area text not null default 'pending_review',
  items_count integer not null default 0,
  payment_method_expected public.payment_method not null,
  lead_source text not null default 'direct_link',
  notes text,
  status public.public_request_status not null default 'new',
  converted_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  sales_unit_label_snapshot text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.public_order_request_items (
  id uuid primary key default gen_random_uuid(),
  public_order_request_id uuid not null references public.public_order_requests(id) on delete cascade,
  product_id uuid not null references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  sales_unit_label_snapshot text not null,
  quantity integer not null,
  unit_price_snapshot numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_user_id uuid references public.profiles(id) on delete set null,
  assigned_date date,
  sequence_number integer,
  delivery_status public.delivery_status not null default 'pending',
  delivered_at timestamptz,
  proof_note text
);

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

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null,
  method public.payment_method not null,
  status text not null default 'received',
  received_by_user_id uuid references public.profiles(id) on delete set null,
  received_at timestamptz,
  reference text
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  rate numeric(5,4) not null default 0.15,
  amount numeric(12,2) not null,
  status public.commission_status not null default 'pending',
  liquidated_at timestamptz
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists public_order_request_items_request_id_idx
  on public.public_order_request_items(public_order_request_id);
create index if not exists public_order_request_items_product_id_idx
  on public.public_order_request_items(product_id);
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
create index if not exists product_families_active_display_order_idx
  on public.product_families(active, display_order, name);
create index if not exists product_variants_family_display_order_idx
  on public.product_variants(product_family_id, active, display_order, label);
create index if not exists product_variants_visibility_display_order_idx
  on public.product_variants(visibility, active, display_order, label);
create index if not exists product_variant_components_component_idx
  on public.product_variant_components(component_variant_id);

insert into public.product_families (
  name,
  slug,
  description,
  active,
  display_order
)
values (
  'Palta Hass',
  'palta-hass',
  'Producto inicial del catalogo.',
  true,
  0
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active,
  display_order = excluded.display_order;

insert into public.product_variants (
  product_family_id,
  label,
  slug,
  description,
  cash_price,
  transfer_price,
  active,
  display_order,
  visibility,
  composition_type
)
select
  pf.id,
  'Caja de 4 kg',
  'palta-hass-caja-4kg',
  'Caja de 4 kg',
  25000,
  30000,
  true,
  0,
  'sellable',
  'simple'
from public.product_families pf
where pf.slug = 'palta-hass'
on conflict (slug) do update
set
  label = excluded.label,
  description = excluded.description,
  cash_price = excluded.cash_price,
  transfer_price = excluded.transfer_price,
  active = excluded.active,
  display_order = excluded.display_order,
  visibility = excluded.visibility,
  composition_type = excluded.composition_type;

update public.product_families
set default_variant_id = pv.id
from public.product_variants pv
where public.product_families.slug = 'palta-hass'
  and pv.slug = 'palta-hass-caja-4kg';
