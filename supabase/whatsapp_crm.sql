alter type public.sales_channel add value if not exists 'whatsapp_ai';

alter table public.customers
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_opt_in boolean not null default true,
  add column if not exists whatsapp_opt_out_at timestamptz,
  add column if not exists last_whatsapp_interaction_at timestamptz,
  add column if not exists preferred_contact_channel text;

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
