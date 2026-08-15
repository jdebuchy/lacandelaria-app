-- Agrega la variante "chica" a la familia Paltas.
-- Las planillas de reparto distinguen palta grande de palta chica desde junio,
-- pero el catálogo tenía una sola variante (paltas-4kg). Sin esta variante no se
-- pueden cargar los pedidos históricos respetando esa distinción.
-- Ambas son cajas de 4kg; lo que cambia es el calibre de la fruta.
-- Seguro de correr más de una vez (el slug es unique).

insert into public.product_variants (
  product_family_id,
  label,
  slug,
  description,
  cash_price,
  transfer_price,
  active,
  display_order,
  visibility,
  composition_type
)
select
  f.id,
  'Caja de 4kg chica',
  'paltas-4kg-chica',
  'Caja de 4kg de palta de calibre chico.',
  20000,
  25000,
  true,
  2,
  'sellable',
  'simple'
from public.product_families f
where f.slug = 'paltas-4kg'
on conflict (slug) do nothing;
