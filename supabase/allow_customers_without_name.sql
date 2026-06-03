alter table public.customers
alter column first_name drop not null;

alter table public.public_order_requests
alter column first_name drop not null;
