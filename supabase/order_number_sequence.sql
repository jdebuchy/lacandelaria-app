-- Numero correlativo legible para pedidos y viajes.
-- Idempotente: se puede correr varias veces sin efecto.
--
-- Garantiza: correlativo, creciente, unico, nunca se reinicia.
-- No garantiza ausencia de huecos: si el alta de un pedido falla despues del
-- insert y se compensa con delete, ese numero queda consumido.

-- Pedidos ---------------------------------------------------------------

alter table public.orders
add column if not exists order_number bigint;

create sequence if not exists public.orders_order_number_seq
  as bigint
  start with 1
  increment by 1;

with numbered as (
  select
    id,
    row_number() over (order by created_at asc, id asc)
      + coalesce((select max(order_number) from public.orders), 0) as next_number
  from public.orders
  where order_number is null
)
update public.orders as o
set order_number = numbered.next_number
from numbered
where o.id = numbered.id;

select setval(
  'public.orders_order_number_seq',
  coalesce((select max(order_number) from public.orders), 0) + 1,
  false
);

alter table public.orders
alter column order_number set default nextval('public.orders_order_number_seq');

alter table public.orders
alter column order_number set not null;

alter sequence public.orders_order_number_seq
owned by public.orders.order_number;

create unique index if not exists orders_order_number_key
  on public.orders(order_number);

-- Viajes ----------------------------------------------------------------

alter table public.delivery_trips
add column if not exists trip_number bigint;

create sequence if not exists public.delivery_trips_trip_number_seq
  as bigint
  start with 1
  increment by 1;

with numbered as (
  select
    id,
    row_number() over (order by created_at asc, id asc)
      + coalesce((select max(trip_number) from public.delivery_trips), 0) as next_number
  from public.delivery_trips
  where trip_number is null
)
update public.delivery_trips as t
set trip_number = numbered.next_number
from numbered
where t.id = numbered.id;

select setval(
  'public.delivery_trips_trip_number_seq',
  coalesce((select max(trip_number) from public.delivery_trips), 0) + 1,
  false
);

alter table public.delivery_trips
alter column trip_number set default nextval('public.delivery_trips_trip_number_seq');

alter table public.delivery_trips
alter column trip_number set not null;

alter sequence public.delivery_trips_trip_number_seq
owned by public.delivery_trips.trip_number;

create unique index if not exists delivery_trips_trip_number_key
  on public.delivery_trips(trip_number);
