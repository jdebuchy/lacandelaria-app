# Delivery: lista general + detalle operativo

## Resumen

Se separó el flujo de `Armado de viajes` del flujo operativo de `Delivery`.

- `Armado de viajes` sigue viviendo en `/panel/logistics`.
- `Delivery` vive en `/panel/logistics/delivery`.
- El detalle operativo de cada viaje vive en `/panel/logistics/delivery/[tripId]`.

La intención es que planificación y ejecución no compartan la misma pantalla ni la misma semántica de estados.

## Criterios de negocio implementados

- `Iniciar nuevo viaje` dentro de `Delivery` navega a `Armado de viajes`.
- Un viaje `completed` es un viaje que terminó operativamente, aunque tenga pedidos `failed`.
- El cierre del viaje es manual desde el detalle operativo.
- Un pedido `failed` vuelve a logística para poder reprogramarse.
- El viaje original conserva el historial del resultado de esa parada.
- Se ignoran referencias a vehículo en la UI de Delivery.

## Cambios de datos

Para no perder historial cuando un pedido falla y luego se reasigna a otro viaje, el resultado operativo ya no depende solo de `deliveries`.

Se agregó:

- `deliveries.failure_reason`
- `delivery_trip_orders.stop_status`
- `delivery_trip_orders.stop_failure_reason`
- `delivery_trip_orders.stop_note`
- `delivery_trip_orders.resolved_at`

Migración: `supabase/delivery_trip_execution_history.sql`

## Estados y semántica

### Viaje

- `assigned`: listo para salir
- `in_route`: viaje iniciado
- `completed`: viaje finalizado manualmente
- `cancelled`: no operativo

### Parada / pedido dentro del viaje

- `pending`
- `in_route`
- `delivered`
- `failed`

### Motivos de no entrega

- `customer_absent`
- `incorrect_address`
- `rejected`
- `closed`
- `other`

## APIs relevantes

### Inicio de viaje

`POST /api/panel/delivery-trips/[tripId]/start`

- pone el viaje en `in_route`
- actualiza pedidos activos a `in_route`
- actualiza entregas activas a `in_route`
- inicializa `delivery_trip_orders.stop_status = in_route`

### Actualización de entrega

`POST /api/driver/update-delivery`

Acepta:

- `orderId`
- `status`
- `failureReason` opcional, requerido si `status = failed`
- `note` opcional
- `payment` opcional, solo para entregas con cobro en efectivo

Efectos:

- actualiza `deliveries`
- actualiza `orders`
- guarda el resultado operativo también en `delivery_trip_orders`
- si falla, libera el pedido para replanificación sin perder historial

### Cierre manual del viaje

`POST /api/panel/delivery-trips/[tripId]/complete`

Valida:

- el viaje debe estar en `in_route`
- no pueden quedar paradas `pending` o `in_route`
- sí puede haber mezcla de `delivered` y `failed`

Efecto:

- `delivery_trips.status = completed`
- `delivery_trips.completed_at = now()`

## UI resultante

### Lista general de Delivery

`/panel/logistics/delivery`

Incluye:

- métricas: activos hoy, próximos, completados, con incidencias
- filtros por búsqueda, estado, fecha y repartidor
- agrupación por `Hoy`, `Mañana`, `Próximos días` y `Viajes anteriores`
- cards por viaje con progreso, incidencias, repartidor y acceso al detalle

### Single operativo de Delivery

`/panel/logistics/delivery/[tripId]`

Incluye:

- KPIs del viaje
- barra de progreso
- tabla operativa de pedidos
- acciones por pedido
- cobro en efectivo desde la misma fila
- motivos de no entrega
- sidebar con incidencias y resumen del viaje

## Notas de implementación

- El planner existente en `/panel/logistics/[tripId]` se conserva como detalle de planificación.
- `syncTripCompletion` dejó de autocompletar viajes para no contradecir la definición de negocio.
- El historial del viaje usa `delivery_trip_orders` como fuente de verdad para resultados ya resueltos.
