alter table public.payments
  alter column received_at set default now();

update public.payments
set received_at = now()
where received_at is null;

alter table public.payments
  alter column received_at set not null;

alter table public.payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists void_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_amount_positive'
  ) then
    alter table public.payments
      add constraint payments_amount_positive check (amount > 0);
  end if;
end $$;

create index if not exists payments_order_id_idx
  on public.payments(order_id);

create index if not exists payments_received_at_idx
  on public.payments(received_at desc);
