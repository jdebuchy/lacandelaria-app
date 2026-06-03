alter table public.customers
add column if not exists instagram text;

alter table public.public_order_requests
add column if not exists instagram text;
