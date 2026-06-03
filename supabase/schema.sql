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
  created_at timestamptz not null default now()
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

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sales_unit_label text not null,
  cash_price numeric(12,2) not null,
  transfer_price numeric(12,2) not null,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete restrict,
  seller_user_id uuid references public.profiles(id) on delete set null,
  reseller_id uuid references public.resellers(id) on delete set null,
  batch_id uuid references public.inventory_batches(id) on delete set null,
  sales_channel public.sales_channel not null default 'internal',
  quantity_boxes integer not null default 1,
  unit_price numeric(12,2) not null,
  items_count integer not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_method_expected public.payment_method not null,
  is_complimentary boolean not null default false,
  status public.order_status not null default 'pending_confirmation',
  payment_status public.payment_status not null default 'pending',
  delivery_date date,
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
  quantity_boxes integer not null default 1,
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
  product_id uuid not null references public.products(id) on delete restrict,
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
  product_id uuid not null references public.products(id) on delete restrict,
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
create index if not exists products_active_display_order_idx
  on public.products(active, display_order, name);

insert into public.products (
  name,
  slug,
  description,
  sales_unit_label,
  cash_price,
  transfer_price,
  active,
  display_order
)
values (
  'Palta',
  'palta',
  'Producto inicial del catalogo.',
  'Caja de 4 kg',
  25000,
  30000,
  true,
  0
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sales_unit_label = excluded.sales_unit_label,
  cash_price = excluded.cash_price,
  transfer_price = excluded.transfer_price,
  active = excluded.active,
  display_order = excluded.display_order;
