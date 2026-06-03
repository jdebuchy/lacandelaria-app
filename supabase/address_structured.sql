alter table public.customers
  add column if not exists first_name text,
  add column if not exists last_name text,
  drop column if exists alternate_phone,
  drop column if exists address,
  drop column if exists neighborhood,
  drop column if exists zone,
  add column if not exists address_kind text not null default 'standard',
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists gated_community_name text,
  add column if not exists locality text,
  add column if not exists administrative_area_level_1 text,
  add column if not exists postal_code text,
  add column if not exists google_place_id text,
  add column if not exists google_place_label text,
  add column if not exists address_source text not null default 'manual',
  add column if not exists delivery_area text not null default 'pending_review';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'full_name'
  ) then
    execute $sql$
      update public.customers
      set
        first_name = case
          when strpos(trim(full_name), ' ') > 0 then regexp_replace(trim(full_name), '\s+[^ ]+$', '')
          else trim(full_name)
        end,
        last_name = case
          when strpos(trim(full_name), ' ') > 0 then regexp_replace(trim(full_name), '^.*\s', '')
          else null
        end
      where first_name is null
    $sql$;
  end if;
end $$;

alter table public.customers
  alter column first_name set not null;

alter table public.customers
  drop column if exists full_name;

alter table public.public_order_requests
  add column if not exists first_name text,
  add column if not exists last_name text,
  drop column if exists address,
  drop column if exists neighborhood,
  drop column if exists zone,
  add column if not exists address_kind text not null default 'standard',
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists gated_community_name text,
  add column if not exists locality text,
  add column if not exists administrative_area_level_1 text,
  add column if not exists postal_code text,
  add column if not exists google_place_id text,
  add column if not exists google_place_label text,
  add column if not exists address_source text not null default 'manual',
  add column if not exists delivery_area text not null default 'pending_review';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'public_order_requests' and column_name = 'full_name'
  ) then
    execute $sql$
      update public.public_order_requests
      set
        first_name = case
          when strpos(trim(full_name), ' ') > 0 then regexp_replace(trim(full_name), '\s+[^ ]+$', '')
          else trim(full_name)
        end,
        last_name = case
          when strpos(trim(full_name), ' ') > 0 then regexp_replace(trim(full_name), '^.*\s', '')
          else null
        end
      where first_name is null
    $sql$;
  end if;
end $$;

alter table public.public_order_requests
  alter column first_name set not null;

alter table public.public_order_requests
  drop column if exists full_name;

alter table public.orders
  drop column if exists zone,
  add column if not exists delivery_area text not null default 'pending_review';
