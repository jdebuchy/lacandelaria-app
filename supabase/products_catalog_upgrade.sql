create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sales_unit_label text not null default 'Caja de 4 kg',
  cash_price numeric(12,2) not null default 25000,
  transfer_price numeric(12,2) not null default 30000,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists description text,
  add column if not exists sales_unit_label text,
  add column if not exists cash_price numeric(12,2),
  add column if not exists transfer_price numeric(12,2),
  add column if not exists active boolean,
  add column if not exists display_order integer,
  add column if not exists created_at timestamptz;

update public.products
set
  sales_unit_label = coalesce(nullif(trim(sales_unit_label), ''), 'Caja de 4 kg'),
  cash_price = coalesce(cash_price, 25000),
  transfer_price = coalesce(transfer_price, 30000),
  active = coalesce(active, true),
  display_order = coalesce(display_order, 0),
  created_at = coalesce(created_at, now());

alter table public.products
  alter column sales_unit_label set default 'Caja de 4 kg',
  alter column sales_unit_label set not null,
  alter column cash_price set default 25000,
  alter column cash_price set not null,
  alter column transfer_price set default 30000,
  alter column transfer_price set not null,
  alter column active set default true,
  alter column active set not null,
  alter column display_order set default 0,
  alter column display_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists products_active_display_order_idx
  on public.products(active, display_order, name);
