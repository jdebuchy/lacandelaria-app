# La Candelaria App

MVP para operar venta, reparto, cobranza y stock de cajas de palta.

## Recomendacion tecnica

La mejor primera version es una `PWA`:

- corre bien en iPhone sin pasar por App Store
- se instala desde Safari en la pantalla de inicio
- permite iterar rapido con un solo codigo base
- reduce costo inicial frente a una app nativa

## Stack propuesto

- `Next.js 15` + `TypeScript`
- `Supabase` para auth, base de datos y storage
- `Mapbox` o Google Maps solo en modulo logistico
- `WhatsApp` via links prearmados en MVP
- `Instagram Lead Ads` o formulario propio en segunda etapa

## Modulos MVP

1. Pedidos
2. Clientes
3. Formulario publico
4. Stock
5. Entregas
6. Cobranza
7. Reportes
8. Roles y permisos

## Roles iniciales

- `admin`: vos, tu papa, tu hermano
- `seller`: revendedores de barrio
- `driver`: transporte y reparto
- `collector`: quien registra cobros

## Reglas de negocio iniciales

- unidad de venta: caja de `4 kg`
- precio efectivo: `25000`
- precio transferencia: `30000`
- comision revendedor de barrio: `15%`
- contemplar pedidos bonificados

## Documentacion

- [Plan de producto](./docs/product-plan.md)
- [Roadmap MVP](./docs/mvp-roadmap.md)
- [Modelo de datos](./docs/data-model.md)

## Siguientes pasos

1. Instalar dependencias
2. Conectar Supabase
3. Implementar autenticacion
4. Construir flujo `pedido publico -> confirmacion interna -> entrega -> cobro`
5. Probar esta semana con familia, revendedores y algunos clientes
