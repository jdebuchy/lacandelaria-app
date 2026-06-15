update public.customers
set instagram = nullif(lower(regexp_replace(btrim(instagram), '^@+', '')), '')
where instagram is not null;

create unique index if not exists customers_instagram_normalized_unique_idx
  on public.customers (lower(btrim(instagram)))
  where nullif(btrim(instagram), '') is not null;
