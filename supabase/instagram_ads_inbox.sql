alter type public.sales_channel add value if not exists 'instagram_ai';

alter table public.customers
  add column if not exists instagram_scoped_user_id text,
  add column if not exists instagram_username text,
  add column if not exists last_instagram_interaction_at timestamptz;

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
