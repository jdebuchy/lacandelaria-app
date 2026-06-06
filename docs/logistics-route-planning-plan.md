# Rediseño de Armado de Pedidos y Routing de Viajes

## Resumen

Rediseñar `/panel/logistics` para simplificar la pantalla de armado y convertir `/panel/logistics/[tripId]` en la experiencia principal de planificación del viaje. La pantalla inicial debe mantener el listado actual de pedidos pendientes para crear el viaje, eliminar métricas/cards no prioritarias y reemplazar el bloque de “viajes recientes” por una lista compacta de viajes creados hoy o pendientes de entrega, como en el boceto. Al crear un viaje, se redirige a la nueva vista de viaje, donde el usuario ve todos los pedidos del viaje, puede reordenarlos con drag and drop, visualizar el recorrido en un mapa y usar un botón `Optimizar ruta` que propone un orden nuevo para confirmar antes de guardarlo.

## Cambios clave

### Simplificar `/panel/logistics`

- Quitar el alerta si existe en el boceto/iteración previa.
- Quitar la métrica de cantidad de repartidores.
- Quitar la distinción visual entre “viaje borrador” y “viaje activo”; evitar cards grandes y pasar a una lista compacta de viajes “creados hoy o pendientes de entrega”.
- Mantener el listado actual de pedidos pendientes como base del armado inicial.
- Conservar el flujo actual de creación de viaje desde `POST /api/panel/delivery-trips`, con redirección inmediata al detalle del viaje.

### Reemplazar la vista actual `/panel/logistics/[tripId]` por una nueva pantalla de planificación

- Columna/lista de pedidos del viaje con drag and drop para definir `sequence_number`.
- Mapa con todos los puntos del recorrido y render del trayecto según el orden actual.
- Botón `Optimizar ruta` que no guarda automáticamente: calcula una propuesta, muestra el nuevo orden/ETA/distancia, y permite `Aplicar` o `Descartar`.
- La ruta manual sigue siendo la fuente de verdad; cualquier reorden manual posterior invalida la propuesta optimizada hasta recalcular.
- Mantener edición básica del viaje (fecha, repartidor, notas), integrada en esta nueva pantalla y no como formulario separado del resto del flujo.

### Routing y optimización

- Si el usuario reordena manualmente, usar `Routes API` para recalcular y mostrar el trayecto entre puntos en ese orden.
- Si el usuario toca `Optimizar ruta`, usar una estrategia automática:
  - Sin ventanas horarias: usar `Routes API` para optimización/secuenciación simple.
  - Con ventanas horarias en los pedidos: usar `Route Optimization API`.
- Diferenciar internamente dos operaciones:
  - `computeDisplayedRoute(tripId, orderedStops)` para pintar mapa, polilínea, ETA y resumen sobre el orden manual actual.
  - `computeOptimizedRoute(tripId)` para pedir una propuesta optimizada según restricciones del viaje/pedidos.
- Persistir el orden únicamente cuando el usuario confirma la propuesta o cuando reordena manualmente y guarda.

### Modelo de datos e interfaces

- Extender el modelo de pedidos para soportar una ventana horaria simple por pedido asociada al pedido mismo, no al viaje.
- Agregar campos equivalentes a `delivery_window_start` y `delivery_window_end` en `orders` o en la tabla más cercana al compromiso de entrega, manteniendo una sola franja `desde/hasta` por pedido en v1.
- Exponer esos campos en los selects usados por logística y en el payload que arma las solicitudes a Google.
- Incorporar en backend una capa nueva para rutas, por ejemplo en `src/lib`, que:
  - normalice stops desde `orders/customers`,
  - arme requests para `Routes API` y `Route Optimization API`,
  - traduzca respuestas a un formato interno único para UI y persistencia.
- Agregar endpoints específicos para el detalle del viaje, en vez de sobrecargar el PATCH actual:
  - uno para reorden manualmente y persistir secuencia,
  - uno para pedir propuesta optimizada,
  - uno para aplicar la propuesta optimizada.
- No cambiar el contrato actual de inicio/cierre de reparto salvo lo necesario para convivir con la nueva secuencia persistida.

### Dependencias y base técnica

- Incorporar una librería de drag and drop moderna para React 19, preferentemente `@dnd-kit`.
- Incorporar la integración de mapa de Google compatible con Next/React actual; la elección concreta puede resolverse al implementar, pero el plan asume Maps JavaScript API + renderer propio de markers/polyline.
- Mantener `GOOGLE_MAPS_API_KEY` para Places y extender configuración para habilitar Routes/Optimization bajo la misma cuenta/proyecto, separando si hace falta flags/env vars de disponibilidad.

## Tests y escenarios

### Pantalla de logística

- muestra pedidos pendientes como hoy;
- no muestra métrica de repartidores;
- muestra lista compacta de viajes creados hoy o pendientes de entrega;
- al crear un viaje redirige al detalle nuevo.

### Detalle de viaje

- carga pedidos en el orden persistido;
- drag and drop cambia el orden visible;
- guardar persiste `delivery_trip_orders.sequence_number` y sincroniza `deliveries.sequence_number`;
- el mapa se recalcula cuando cambia el orden manual.

### Optimización

- sin ventanas horarias usa `Routes API`;
- con ventanas horarias usa `Route Optimization API`;
- devuelve una propuesta sin sobrescribir la secuencia hasta confirmación;
- al aplicar la propuesta se persisten secuencia, resumen de ruta y cualquier metadata útil.

### Ventanas horarias

- pedido sin ventana sigue funcionando;
- pedido con `desde/hasta` participa en optimización;
- validación rechaza ventanas inválidas o incompletas según la regla elegida en implementación.

### Robustez

- fallback claro si Google responde error o no hay ruta válida;
- cambios manuales después de optimizar invalidan la propuesta anterior;
- viajes completados/cancelados siguen bloqueando edición.

## Supuestos y defaults

- La nueva vista de viaje reemplaza la actual `/panel/logistics/[tripId]`; no se mantiene una segunda experiencia paralela.
- `Optimizar ruta` muestra propuesta y requiere confirmación antes de guardar.
- Las restricciones horarias entran en v1 y viven en el modelo del pedido.
- La granularidad de horarios en v1 es una sola franja `inicio-fin` por pedido.
- La selección entre `Routes API` y `Route Optimization API` será automática según exista o no ventana horaria.
- La rama se crea al comenzar implementación. Nombre sugerido: `feat/logistics-route-planning`.
- Hay cambios locales no relacionados en el worktree; la implementación debe evitar tocarlos salvo conflicto directo.
