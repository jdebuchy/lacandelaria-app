create extension if not exists pgcrypto;

create table if not exists public.product_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  default_variant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_family_id uuid not null references public.product_families(id) on delete cascade,
  label text not null,
  slug text not null unique,
  description text,
  cash_price numeric(12,2) not null default 0,
  transfer_price numeric(12,2) not null default 0,
  active boolean not null default true,
  display_order integer not null default 0,
  visibility text not null default 'sellable' check (visibility in ('sellable', 'internal')),
  composition_type text not null default 'simple' check (composition_type in ('simple', 'bundle')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_families_default_variant_id_fkey'
  ) then
    alter table public.product_families
      add constraint product_families_default_variant_id_fkey
      foreign key (default_variant_id) references public.product_variants(id) on delete set null;
  end if;
end $$;

create table if not exists public.product_variant_components (
  bundle_variant_id uuid not null references public.product_variants(id) on delete cascade,
  component_variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity numeric(12,2) not null,
  created_at timestamptz not null default now(),
  primary key (bundle_variant_id, component_variant_id),
  constraint product_variant_components_no_self_reference
    check (bundle_variant_id <> component_variant_id)
);

create index if not exists product_families_active_display_order_idx
  on public.product_families(active, display_order, name);
create index if not exists product_variants_family_display_order_idx
  on public.product_variants(product_family_id, active, display_order, label);
create index if not exists product_variants_visibility_display_order_idx
  on public.product_variants(visibility, active, display_order, label);
create index if not exists product_variant_components_component_idx
  on public.product_variant_components(component_variant_id);

do $$
declare
  has_legacy_products boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'products'
  )
  into has_legacy_products;

  if not has_legacy_products then
    return;
  end if;

  create temporary table tmp_catalog_backfill_map (
    legacy_product_id uuid primary key,
    family_id uuid not null
  ) on commit drop;

  insert into tmp_catalog_backfill_map (legacy_product_id, family_id)
  select p.id, gen_random_uuid()
  from public.products p
  left join public.product_variants pv on pv.id = p.id
  where pv.id is null
  on conflict (legacy_product_id) do nothing;

  insert into public.product_families (id, name, slug, description, active, display_order, created_at)
  select
    m.family_id,
    p.name,
    p.slug,
    p.description,
    coalesce(p.active, true),
    coalesce(p.display_order, 0),
    coalesce(p.created_at, now())
  from public.products p
  join tmp_catalog_backfill_map m on m.legacy_product_id = p.id
  on conflict (id) do nothing;

  insert into public.product_variants (
    id,
    product_family_id,
    label,
    slug,
    description,
    cash_price,
    transfer_price,
    active,
    display_order,
    visibility,
    composition_type,
    created_at
  )
  select
    p.id,
    m.family_id,
    coalesce(nullif(trim(p.sales_unit_label), ''), 'Unidad'),
    p.slug,
    p.description,
    coalesce(p.cash_price, 0),
    coalesce(p.transfer_price, 0),
    coalesce(p.active, true),
    coalesce(p.display_order, 0),
    'sellable',
    'simple',
    coalesce(p.created_at, now())
  from public.products p
  join tmp_catalog_backfill_map m on m.legacy_product_id = p.id
  on conflict (id) do nothing;

  update public.product_families pf
  set default_variant_id = pv.id
  from public.product_variants pv
  where pv.product_family_id = pf.id
    and pf.default_variant_id is null;

  alter table public.order_items drop constraint if exists order_items_product_id_fkey;
  alter table public.public_order_request_items drop constraint if exists public_order_request_items_product_id_fkey;

  alter table public.order_items
    add constraint order_items_product_id_fkey
    foreign key (product_id) references public.product_variants(id) on delete restrict;

  alter table public.public_order_request_items
    add constraint public_order_request_items_product_id_fkey
    foreign key (product_id) references public.product_variants(id) on delete restrict;

  drop table public.products;
end $$;
