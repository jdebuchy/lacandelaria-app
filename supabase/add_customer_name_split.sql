-- Agrega first_name y last_name sin tocar la columna full_name existente.
-- Seguro de correr más de una vez (IF NOT EXISTS).

alter table public.customers
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- Migra registros existentes que aún no tienen first_name
update public.customers
set
  first_name = case
    when full_name like '% %' then regexp_replace(full_name, ' [^ ]+$', '')
    else full_name
  end,
  last_name = case
    when full_name like '% %' then regexp_replace(full_name, '^.* ', '')
    else null
  end
where first_name is null;

alter table public.customers alter column first_name set not null;
