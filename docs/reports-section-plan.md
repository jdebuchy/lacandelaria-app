# Sección de reportes

## Resumen

Crear una nueva sección `/panel/reports` para ver métricas comerciales, cobranza, clientes, productos y logística con filtros por fecha, agrupación temporal y comparación contra período anterior.

La primera versión debe funcionar con los datos actuales y dejar preparada la conexión futura con stock por variante/componentes.

La sección será accesible para `admin`, `seller` y `collector`; los datos sensibles de cobranza completa se mostrarán a `admin` y `collector`.

## Cambios clave

- Agregar navegación `Reportes` al panel interno.
- Crear una página principal con filtros globales:
  - rango de fechas
  - preset rápido
  - agrupación por `día`, `semana` o `mes`
  - canal
  - zona
  - estado de pedido
  - método de pago
  - producto
- Mostrar KPIs principales:
  - ventas
  - pedidos
  - unidades vendidas
  - ticket promedio
  - cobrado
  - saldo pendiente
  - pedidos cancelados
  - tasa de conversión de solicitudes públicas
- Comparar los KPIs contra el período anterior con variación absoluta y porcentual.

## Reportes por módulo

### Ventas

- Ingresos y pedidos por tiempo.
- Ventas por canal, zona, vendedor/revendedor, estado y método esperado.

### Productos

- Ranking por producto base.
- Ranking por variante vendida.
- Unidades vendidas.
- Facturación.
- Ticket medio.
- Mix de productos.

### Cobranza

- Cobrado por fecha.
- Efectivo vs transferencia.
- Estado pendiente, parcial o pagado.
- Deuda por antigüedad.

### Clientes

- Clientes nuevos vs recurrentes.
- Zonas/localidades.
- Top clientes por compra.
- Frecuencia de recompra.

### Logística

- Pedidos por fecha de entrega.
- Pedidos por zona.
- Estado de viaje.
- Entregados y fallidos.
- Volumen por repartidor cuando aplique.

### Stock futuro

- Tarjetas deshabilitadas o sección `cuando stock esté activo` para:
  - rotación
  - consumo por componente
  - merma
  - cobertura

## Plan de implementación

- Crear una capa `src/lib/reports.ts` con funciones puras de agregación para mantener la página simple:
  - normalización de rangos en timezone `America/Argentina/Buenos_Aires`
  - bucket temporal por día, semana o mes
  - comparación con período anterior
  - agregados por producto, canal, zona, pago, cliente y logística
- La página `/panel/reports` consultará Supabase en server components usando `searchParams`.
- Los filtros deben persistir en URL para poder compartir vistas y volver atrás sin perder contexto.
- Usar componentes SVG internos sin sumar dependencia externa:
  - línea para tendencia temporal
  - barras para comparaciones por período/categoría
  - barras apiladas para estados o métodos
  - donut simple para mix de canales/pagos
  - tabla ranking para productos/clientes/zonas
- No crear migraciones para stock en esta etapa; solo diseñar los agregados para que luego acepten consumo por componente.

## Tablas iniciales

- `orders`
- `order_items`
- `product_variants`
- `product_families`
- `payments`
- `customers`
- `public_order_requests`
- `delivery_trips`
- `delivery_trip_orders`
- `deliveries`

## Vista ejecutiva

- Ventas totales.
- Pedidos totales.
- Unidades vendidas.
- Ticket promedio.
- Cobrado.
- Saldo pendiente.
- Solicitudes públicas nuevas/convertidas.
- Variación contra período anterior.

## Tendencias

- Ventas en el tiempo.
- Pedidos en el tiempo.
- Cobranza en el tiempo.
- Comparación período actual vs anterior.

## Comparaciones

- Ventas por canal: interno, formulario público, revendedor.
- Ventas por zona/localidad.
- Ventas por producto base y variante.
- Cobranza por método.
- Estados de pedidos.

## Operación

- Pedidos pendientes de confirmación.
- Pedidos confirmados, asignados, en ruta, entregados y cancelados.
- Entregas por fecha y zona.
- Fallidos o pendientes de entrega.

## Plan de pruebas

- Verificar rangos:
  - hoy
  - últimos 7 días
  - últimos 30 días
  - mes actual
  - mes anterior
  - rango custom
- Verificar agrupación por día, semana y mes.
- Verificar que los totales coincidan con pedidos y pagos existentes.
- Verificar que pedidos cancelados no inflen ventas netas.
- Verificar que pedidos bonificados cuenten unidades pero no facturación.
- Verificar que pagos anulados no cuenten como cobrado.
- Verificar estados vacíos: sin pedidos, sin pagos, sin productos o sin entregas.
- Verificar permisos por rol.
- Ejecutar `npm run build` como validación final.

## Supuestos

- `Ventas` significa pedidos no cancelados; cancelados se muestran aparte.
- `Facturación` usa `orders.total_amount`.
- `Cobrado` usa pagos con `status = received` y excluye pagos anulados.
- `Unidades vendidas` usa `order_items.quantity`.
- La fecha principal para ventas será `orders.created_at`.
- Logística usará `delivery_date` o `scheduled_date`.
- Stock queda fuera de implementación activa, pero el diseño prepara reportes por variante y componentes para conectarlo después.
