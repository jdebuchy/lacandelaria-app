# Plan de producto

## Objetivo

Lanzar rapido una aplicacion operativa para vender, despachar y cobrar cajas de palta sin perder control de stock ni de dinero.

## Decisiones principales

### 1. Canal

Arrancar con `PWA` y no con app nativa iOS.

Motivos:

- menor tiempo de salida
- una sola base de codigo
- evita App Store y revisiones
- suficiente para operaciones internas y red de revendedoras

La app nativa solo tendria sentido mas adelante si necesitan tracking en segundo plano, notificaciones push avanzadas o experiencia offline compleja.

### 2. Pedido online

El cliente final no tendra cuenta ni password en el MVP.

El canal online inicial sera un `formulario publico`:

- captura nombre, telefono, direccion, zona y pedido
- deja el pedido en estado pendiente
- requiere revision interna antes de confirmarse
- evita friccion para clientes nuevos o de Instagram

Mas adelante se puede extender a cuentas de cliente, historial y recompra sin romper el modelo base.

### 3. Alcance del MVP

El MVP no debe intentar resolver marketing, CRM avanzado y ruteo optimizado al mismo tiempo. Debe enfocarse en el flujo operativo central:

1. captar pedido interno o publico
2. revisar y confirmar pedido
3. reservar stock
4. asignar entrega
5. marcar entregado
6. registrar cobro
7. calcular comision
8. ver caja y pendientes

## Problemas a resolver

### Venta

- todos los vendedores ya operan con el mismo criterio comercial
- hace falta saber quien vendio cada pedido
- hace falta registrar el medio de pago esperado al crear el pedido

### Logistica

- Capital Federal complica las entregas porque muchas veces el cliente no esta en su domicilio
- GBA y barrios periféricos suelen ser mas simples por mayor disponibilidad del cliente
- el transporte necesita ver pedidos por zona
- hay que evitar demoras porque la palta madura rapido

### Cobranza

- hace falta distinguir entregado de cobrado
- hace falta saber si el pago fue efectivo o transferencia
- hace falta un canal simple de reclamo

### Stock

- el sistema debe manejar stock por cajas sin depender de una cantidad inicial fija
- cada pedido debe descontar stock comprometido
- cancelaciones y cajas bonificadas deben quedar contempladas

### CRM

- consolidar clientes y revendedoras
- registrar historial de compra
- preparar acciones de recontacto

## Usuarios y permisos

### Admin

Puede ver todo, editar todo y acceder a reportes.

Casos:

- alta de usuarios
- ajuste de stock
- cambio de precios
- cierre de caja
- auditoria de cobros y comisiones

### Seller

Puede crear pedidos, ver sus clientes, ver su comision y consultar estado de sus entregas.

No debe poder:

- modificar stock global
- ver finanzas completas de terceros
- cambiar precios historicos
- ver reportes sensibles

### Driver

Puede ver entregas asignadas, marcar estados y abrir contacto con cliente.

No debe poder:

- cambiar montos
- editar clientes libremente
- ver reportes sensibles

### Collector

Puede registrar pagos y dejar observaciones de cobranza.

## Flujo operativo recomendado

### Flujo A: pedido directo

1. vendedor crea pedido
2. sistema reserva una caja
3. se asigna zona y fecha tentativa
4. repartidor recibe lista agrupada
5. pedido pasa a `entregado`
6. se registra pago o queda `pendiente`

### Flujo B: revendedora por barrio

1. revendedora consolida pedidos del barrio
2. genera lote de reparto
3. transporte lleva cajas al punto de entrega
4. revendedora distribuye o coordina retiro
5. se confirma entrega final
6. se liquidan comision y pagos pendientes

Estas revendedoras o revendedores tienen reglas claras y consistentes. La app debe facilitarles la carga y el seguimiento, no imponerles un criterio comercial nuevo.

## Modulos MVP

### Pedidos

- alta manual
- alta desde formulario publico
- cliente, direccion, barrio, zona
- vendedor o revendedor responsable
- medio de pago esperado
- precio aplicado segun forma de pago
- observaciones de entrega
- opcion de pedido bonificado
- estado de revision inicial

### Clientes

- nombre
- telefono
- direccion
- barrio / zona
- ultima compra
- notas
- origen del lead o pedido

### Stock

- stock disponible
- stock reservado
- stock entregado
- stock perdido / merma
- stock bonificado

### Entregas

- vista por fecha y zona
- asignacion a repartidor
- estados: pendiente, en ruta, entregado, fallido
- boton WhatsApp al cliente

### Cobranza

- estados: pendiente, parcial, pagado
- metodo: efectivo, transferencia
- fecha y responsable del cobro
- recordatorio por WhatsApp

### Reportes

- ventas por dia
- ventas por vendedor
- cajas entregadas
- cobranza pendiente
- comision por revendedora
- stock remanente
- pedidos publicos pendientes de confirmacion

## Lo que dejo fuera del MVP

- integracion oficial con WhatsApp API
- optimizacion automatica de rutas
- tracking GPS en vivo
- campaña avanzada de paid media
- cuenta de cliente final
- autogestion completa de pedidos por cliente

## Hipotesis operativas

- base activa inicial: hasta `1000` clientes
- volumen actual manejable con una sola base de datos
- uso principal en iPhone
- internet disponible la mayor parte del tiempo

## Riesgos

- desorden de estados si todos editan sin reglas
- falta de disciplina para registrar cobros
- direcciones incompletas
- dependencia de WhatsApp manual al inicio

## Criterio de exito del MVP

Esta semana deben poder:

- registrar todos los pedidos en un solo lugar
- recibir pedidos publicos sin necesidad de login del cliente
- saber cuantas cajas hay disponibles
- despachar por zona
- detectar quien debe dinero
- liquidar comisiones de revendedores sin Excel paralelo
