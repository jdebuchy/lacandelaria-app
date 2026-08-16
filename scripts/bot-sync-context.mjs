// Regenera commercial_settings.catalog_context desde la base: zonas de entrega,
// catalogo vendible y precios reales.
//
// Existe para que el bot pueda contestar precios y zonas sin inventarlos. La regla
// del proyecto no es "el bot no habla de precios", es "los precios salen del ERP":
// mientras el contexto se genere desde aca, se cumple. Correlo despues de tocar
// el catalogo o las zonas.
//
// Uso: node --env-file=.env.local scripts/bot-sync-context.mjs [--dry]

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const dry = process.argv.includes("--dry");

// Las claves de delivery_area de la base, traducidas a como las nombra un cliente.
const ZONAS = {
  capital_federal: "Capital Federal (CABA)",
  standard: "Gran Buenos Aires (GBA)"
};

const { data: familias, error: errFamilias } = await db
  .from("product_families")
  .select("id, name, active")
  .eq("active", true);

const { data: variantes, error: errVariantes } = await db
  .from("product_variants")
  .select("product_family_id, label, cash_price, transfer_price, active, visibility")
  .eq("active", true)
  .eq("visibility", "sellable");

if (errFamilias || errVariantes) {
  console.error(`No pude leer el catalogo: ${errFamilias?.message ?? errVariantes?.message}`);
  process.exit(1);
}

const nombreFamilia = new Map((familias ?? []).map((f) => [f.id, f.name]));

const productos = (variantes ?? [])
  .map((v) => ({
    producto: nombreFamilia.get(v.product_family_id) ?? "Sin familia",
    presentacion: v.label,
    precio_efectivo: Number(v.cash_price),
    precio_transferencia: Number(v.transfer_price)
  }))
  .filter((p) => p.producto !== "Sin familia")
  .sort((a, b) => a.producto.localeCompare(b.producto) || a.presentacion.localeCompare(b.presentacion));

const context = {
  main_product: "Caja de paltas premium de 4kg",
  delivery_zones: Object.values(ZONAS),
  delivery_zones_note:
    "Solo entregamos en Capital Federal y Gran Buenos Aires. Fuera de esas zonas no hacemos envios: deci que no llegamos y ofrece avisarle si en algun momento ampliamos.",
  payment_methods: ["efectivo", "transferencia"],
  price_note:
    "Los precios de esta lista son los vigentes y podes decirlos. El precio en efectivo es menor que por transferencia. No ofrezcas descuentos ni condiciones que no esten aca.",
  products: productos,
  stock_note:
    "No tenes informacion de stock en tiempo real. Si preguntan por disponibilidad de una fecha puntual, deci que lo confirma alguien del equipo.",
  // Los consume src/lib/bot/capabilities.ts para decidir que puede contestar el
  // bot sin derivar. Si los sacas de aca, vuelve a derivar precios y zonas.
  can_answer: { delivery_zones: true, prices: true, products: true }
};

console.log(JSON.stringify(context, null, 2));

if (dry) {
  console.log("\n(--dry: no escribi nada)");
  process.exit(0);
}

const { error } = await db
  .from("commercial_settings")
  .update({ value: context, updated_at: new Date().toISOString() })
  .eq("key", "catalog_context");

if (error) {
  console.error(`\nNo pude guardar: ${error.message}`);
  process.exit(1);
}

console.log(`\nGuardado. ${productos.length} productos y ${context.delivery_zones.length} zonas.`);
