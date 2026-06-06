alter table public.deliveries
  add column if not exists failure_reason text;

alter table public.delivery_trip_orders
  add column if not exists stop_status public.delivery_status,
  add column if not exists stop_failure_reason text,
  add column if not exists stop_note text,
  add column if not exists resolved_at timestamptz;
