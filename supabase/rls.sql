alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.resellers enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.orders enable row level security;
alter table public.public_order_requests enable row level security;
alter table public.deliveries enable row level security;
alter table public.logistics_depots enable row level security;
alter table public.delivery_trips enable row level security;
alter table public.delivery_trip_orders enable row level security;
alter table public.payments enable row level security;
alter table public.commissions enable row level security;

create policy "public can insert order requests"
on public.public_order_requests
for insert
to anon, authenticated
with check (true);

create policy "authenticated can read order requests"
on public.public_order_requests
for select
to authenticated
using (true);

create policy "authenticated can update order requests"
on public.public_order_requests
for update
to authenticated
using (true)
with check (true);

create policy "authenticated can manage customers"
on public.customers
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage resellers"
on public.resellers
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage inventory batches"
on public.inventory_batches
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage orders"
on public.orders
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage deliveries"
on public.deliveries
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage logistics depots"
on public.logistics_depots
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage delivery trips"
on public.delivery_trips
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage delivery trip orders"
on public.delivery_trip_orders
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage payments"
on public.payments
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage commissions"
on public.commissions
for all
to authenticated
using (true)
with check (true);

create policy "authenticated can manage profiles"
on public.profiles
for all
to authenticated
using (true)
with check (true);
