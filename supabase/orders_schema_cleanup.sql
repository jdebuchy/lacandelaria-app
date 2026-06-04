alter table public.orders
  add column if not exists items_count integer not null default 0,
  add column if not exists total_amount numeric(12,2) not null default 0,
  add column if not exists delivery_area text not null default 'pending_review';

update public.orders
set
  items_count = coalesce(items_count, 0),
  total_amount = coalesce(total_amount, 0),
  delivery_area = coalesce(nullif(delivery_area, ''), 'pending_review');

alter table public.orders
  drop column if exists quantity_boxes,
  drop column if exists unit_price;

alter table public.public_order_requests
  add column if not exists items_count integer not null default 0,
  add column if not exists delivery_area text not null default 'pending_review';

update public.public_order_requests
set
  items_count = coalesce(items_count, 0),
  delivery_area = coalesce(nullif(delivery_area, ''), 'pending_review');

alter table public.public_order_requests
  drop column if exists quantity_boxes;
