alter table public.customers
  add column if not exists updated_at timestamptz;

update public.customers
set updated_at = coalesce(updated_at, created_at, now());

alter table public.customers
  alter column updated_at set default now(),
  alter column updated_at set not null;
