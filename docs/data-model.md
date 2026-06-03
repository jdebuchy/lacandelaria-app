# Modelo de datos

## Entidades

### users

- id
- full_name
- phone
- role: `admin | seller | driver | collector`
- active
- created_at

### customers

- id
- full_name
- phone
- alternate_phone
- address
- neighborhood
- zone
- delivery_notes
- source: `instagram | referred | repeat | reseller`
- auth_user_id nullable
- created_at

### resellers

- id
- full_name
- phone
- neighborhood
- zone
- commission_rate
- payout_notes
- active

### inventory_batches

- id
- origin
- received_at
- boxes_received
- boxes_available
- boxes_reserved
- boxes_delivered
- boxes_waste
- notes

### orders

- id
- customer_id
- seller_user_id
- sales_channel: `internal | public_form | reseller`
- reseller_id nullable
- batch_id
- quantity_boxes
- unit_price
- payment_method_expected: `cash | transfer`
- is_complimentary
- status: `pending_confirmation | confirmed | assigned | in_route | delivered | cancelled`
- payment_status: `pending | partial | paid`
- delivery_date
- zone
- notes
- created_at

### public_order_requests

- id
- full_name
- phone
- address
- neighborhood
- zone
- quantity_boxes
- payment_method_expected: `cash | transfer`
- lead_source: `instagram | whatsapp | direct_link | reseller`
- notes
- status: `new | reviewed | converted | rejected`
- converted_order_id nullable
- created_at

### deliveries

- id
- order_id
- driver_user_id
- assigned_date
- sequence_number
- delivery_status: `pending | in_route | delivered | failed`
- delivered_at
- proof_note

### payments

- id
- order_id
- amount
- method: `cash | transfer`
- status: `pending | received | rejected`
- received_by_user_id
- received_at
- reference

### commissions

- id
- order_id
- reseller_id
- rate
- amount
- status: `pending | liquidated`
- liquidated_at

## Reglas

- un pedido publico no descuenta stock hasta ser confirmado
- cada pedido descuenta stock reservado
- un pedido entregado pasa stock de reservado a entregado
- un pedido cancelado devuelve stock
- un pedido bonificado descuenta stock pero no genera cobranza
- la comision nace al confirmar el pedido
- la cobranza se cierra con suma de pagos igual al total del pedido

## Vistas utiles

### dashboard diario

- pedidos confirmados hoy
- cajas reservadas hoy
- cajas entregadas hoy
- monto cobrado hoy
- deuda pendiente total

### panel de reparto

- pedidos por zona
- pedidos por repartidor
- pedidos fallidos

### panel comercial

- ventas por vendedor
- ventas por revendedora
- clientes nuevos vs recurrentes
