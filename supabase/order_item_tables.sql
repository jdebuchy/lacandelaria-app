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

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists public_order_request_items_request_id_idx
  on public.public_order_request_items(public_order_request_id);
create index if not exists public_order_request_items_product_id_idx
  on public.public_order_request_items(product_id);
