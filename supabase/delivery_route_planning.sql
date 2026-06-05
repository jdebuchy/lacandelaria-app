alter table public.orders
  add column if not exists delivery_window_start time,
  add column if not exists delivery_window_end time;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_delivery_window_range_check'
  ) then
    alter table public.orders
      add constraint orders_delivery_window_range_check
      check (
        (delivery_window_start is null and delivery_window_end is null)
        or (
          delivery_window_start is not null
          and delivery_window_end is not null
          and delivery_window_start <= delivery_window_end
        )
      );
  end if;
end $$;
