create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'seller', 'driver', 'collector');
create type public.payment_method as enum ('unknown', 'cash', 'transfer');
create type public.order_status as enum (
  'pending_confirmation',
  'confirmed',
  'assigned',
  'in_route',
  'delivered',
  'cancelled'
);
create type public.payment_status as enum ('pending', 'partial', 'paid');
create type public.sales_channel as enum ('internal', 'public_form', 'reseller', 'whatsapp_ai', 'instagram_ai');
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
  whatsapp_phone text,
  whatsapp_opt_in boolean not null default true,
  whatsapp_opt_out_at timestamptz,
  last_whatsapp_interaction_at timestamptz,
  instagram_scoped_user_id text,
  instagram_username text,
  last_instagram_interaction_at timestamptz,
  preferred_contact_channel text,
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
  proof_note text,
  failure_reason text
);

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

create table if not exists public.delivery_trips (
  id uuid primary key default gen_random_uuid(),
  depot_id uuid not null references public.logistics_depots(id) on delete restrict,
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
  stop_status public.delivery_status,
  stop_failure_reason text,
  stop_note text,
  resolved_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null,
  status text not null default 'received',
  received_by_user_id uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by_user_id uuid references public.profiles(id) on delete set null,
  void_reason text,
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

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  phone text not null,
  status text not null default 'idle',
  current_intent text,
  ai_confidence numeric(4,3),
  draft_order jsonb,
  requires_human boolean not null default false,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null,
  body text not null,
  ai_intent text,
  ai_confidence numeric(4,3),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_message_queue (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  message_type text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz not null,
  phone text not null,
  body text not null,
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_message_queue_unique_order_type unique (order_id, message_type)
);

create table if not exists public.whatsapp_automation_settings (
  id uuid primary key default gen_random_uuid(),
  message_type text not null unique,
  active boolean not null default true,
  days_after_delivered integer not null,
  daily_limit integer not null default 40,
  random_delay_min_seconds integer not null default 45,
  random_delay_max_seconds integer not null default 180,
  template_body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_commercial_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  requires_human boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists public_order_request_items_request_id_idx
  on public.public_order_request_items(public_order_request_id);
create index if not exists public_order_request_items_product_id_idx
  on public.public_order_request_items(product_id);
create unique index if not exists customers_instagram_normalized_unique_idx
  on public.customers (lower(btrim(instagram)))
  where nullif(btrim(instagram), '') is not null;
create index if not exists deliveries_order_id_idx on public.deliveries(order_id);
create index if not exists logistics_depots_active_label_idx
  on public.logistics_depots(active, label);
create index if not exists delivery_trips_scheduled_date_status_idx
  on public.delivery_trips(scheduled_date, status, created_at desc);
create index if not exists delivery_trips_driver_status_idx
  on public.delivery_trips(driver_user_id, status, scheduled_date);
create index if not exists delivery_trips_depot_scheduled_date_idx
  on public.delivery_trips(depot_id, scheduled_date, created_at desc);
create index if not exists delivery_trip_orders_trip_sequence_idx
  on public.delivery_trip_orders(delivery_trip_id, sequence_number);
create unique index if not exists delivery_trip_orders_active_order_idx
  on public.delivery_trip_orders(order_id)
  where released_at is null;
create index if not exists payments_order_id_idx
  on public.payments(order_id);
create index if not exists payments_received_at_idx
  on public.payments(received_at desc);
create index if not exists product_families_active_display_order_idx
  on public.product_families(active, display_order, name);
create index if not exists product_variants_family_display_order_idx
  on public.product_variants(product_family_id, active, display_order, label);
create index if not exists product_variants_visibility_display_order_idx
  on public.product_variants(visibility, active, display_order, label);
create index if not exists product_variant_components_component_idx
  on public.product_variant_components(component_variant_id);
create index if not exists whatsapp_conversations_customer_updated_idx
  on public.whatsapp_conversations(customer_id, updated_at desc);
create index if not exists whatsapp_conversations_status_updated_idx
  on public.whatsapp_conversations(status, updated_at desc);
create index if not exists whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages(conversation_id, created_at desc);
create index if not exists whatsapp_messages_customer_created_idx
  on public.whatsapp_messages(customer_id, created_at desc);
create index if not exists whatsapp_message_queue_status_scheduled_idx
  on public.whatsapp_message_queue(status, scheduled_for);

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

insert into public.whatsapp_automation_settings (
  message_type,
  active,
  days_after_delivered,
  daily_limit,
  random_delay_min_seconds,
  random_delay_max_seconds,
  template_body
)
values
  (
    'satisfaction_check',
    true,
    7,
    40,
    45,
    180,
    'Hola {nombre}! Soy de Paltas La Candelaria 🥑

Queríamos saber cómo te fue con la caja de paltas premium de 4kg que recibiste la semana pasada.

¿Llegaron bien? ¿Estaban en el punto que esperabas?'
  ),
  (
    'reactivation_offer',
    true,
    21,
    40,
    45,
    180,
    'Hola {nombre}! Ya pasaron unas semanas desde tu última caja de paltas premium 🥑

Esta semana volvemos a tomar pedidos de cajas de 4kg. ¿Querés que te reserve una?'
  )
on conflict (message_type) do nothing;

insert into public.whatsapp_commercial_settings (key, value, requires_human)
values
  (
    'catalog_context',
    '{"main_product":"Caja de paltas premium de 4kg","complementary_products":["Frutos secos"],"payment_methods":["cash","transfer"],"delivery_zones":[],"available_delivery_dates":[],"current_prices_source":"product_variants","stock_source":"inventory_batches"}'::jsonb,
    false
  ),
  (
    'human_required_actions',
    '{"actions":["complaint","discount_request","delivery_exception","stock_exception","price_exception","zone_exception"]}'::jsonb,
    true
  )
on conflict (key) do nothing;

create table if not exists public.instagram_conversations (
  id uuid primary key default gen_random_uuid(),
  external_thread_id text,
  instagram_scoped_user_id text not null,
  instagram_username text,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid,
  source text not null default 'instagram',
  source_detail text not null default 'instagram_ad',
  campaign_id text,
  adset_id text,
  ad_id text,
  referral jsonb,
  status text not null default 'new' check (status in ('new', 'bot_active', 'waiting_customer', 'human_needed', 'qualified', 'order_created', 'lost', 'closed')),
  automation_enabled boolean not null default false,
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_intent text,
  last_ai_confidence numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_conversations_scoped_user_unique unique (instagram_scoped_user_id)
);

create table if not exists public.instagram_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.instagram_conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  external_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  text text,
  attachments jsonb,
  raw_payload jsonb,
  sent_by_user_id uuid references public.profiles(id) on delete set null,
  meta_response jsonb,
  error jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.instagram_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  raw_payload jsonb not null,
  headers jsonb,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.instagram_leads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.instagram_conversations(id) on delete cascade,
  name text,
  phone text,
  neighborhood text,
  delivery_address text,
  product_interest text,
  quantity integer,
  payment_method text,
  lead_status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'instagram_conversations_lead_id_fkey'
  ) then
    alter table public.instagram_conversations
      add constraint instagram_conversations_lead_id_fkey
      foreign key (lead_id) references public.instagram_leads(id) on delete set null;
  end if;
end $$;

create table if not exists public.instagram_automation_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.instagram_conversations(id) on delete cascade,
  message_id uuid references public.instagram_messages(id) on delete set null,
  intent text,
  confidence numeric(4,3),
  action_taken text,
  ai_model text,
  prompt_version text,
  input jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);

create index if not exists instagram_conversations_updated_idx
  on public.instagram_conversations(updated_at desc);
create index if not exists instagram_conversations_status_updated_idx
  on public.instagram_conversations(status, updated_at desc);
create index if not exists instagram_conversations_customer_updated_idx
  on public.instagram_conversations(customer_id, updated_at desc);
create index if not exists instagram_conversations_campaign_updated_idx
  on public.instagram_conversations(campaign_id, updated_at desc);
create index if not exists instagram_messages_conversation_created_idx
  on public.instagram_messages(conversation_id, created_at asc);
create index if not exists instagram_messages_customer_created_idx
  on public.instagram_messages(customer_id, created_at desc);
create index if not exists instagram_webhook_events_created_idx
  on public.instagram_webhook_events(created_at desc);
create index if not exists instagram_leads_conversation_idx
  on public.instagram_leads(conversation_id);
