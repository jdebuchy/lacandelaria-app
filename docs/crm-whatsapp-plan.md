> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

# Ejecucion: CRM WhatsApp En Branch Nueva

## Preparacion

- Crear branch nueva: `feat/crm-whatsapp`.
- Guardar este plan en `docs/crm-whatsapp-plan.md`.
- Mantener cambios locales existentes de logistica sin revertirlos ni mezclarlos salvo conflicto directo.

## Implementacion Por Etapas

- Etapa 1: agregar migracion `supabase/whatsapp_crm.sql`, actualizar `supabase/schema.sql`, tipos en `src/lib/types.ts`, config/env y README.
- Etapa 2: agregar `CRM` en `src/components/panel-nav.tsx`, crear rutas `CRM > WhatsApp` y queries de lectura.
- Etapa 3: crear single de cliente `/panel/customers/[customerId]` con tabs `Perfil`, `Pedidos`, `WhatsApp`, y link desde el listado.
- Etapa 4: crear APIs internas/admin para WhatsApp y pedido `sales_channel = whatsapp_ai`.
- Etapa 5: crear `services/whatsapp-worker` con Express, Supabase, whatsapp-web.js, OpenRouter, queue builder/processor e inbound handler.
- Etapa 6: documentar Railway, variables, flujo de QR/session path, limites, opt-out y operacion manual.

## Verificacion

- Ejecutar typecheck/build de Next.
- Validar que `/panel/customers`, `/panel/customers/[id]`, `/panel/crm/whatsapp`, cola, automatizaciones y settings rendericen.
- Validar SQL contra Supabase antes de usar el worker.
- Probar worker localmente sin enviar masivo: health, build queue, process queue con pocos registros, inbound, opt-out, reclamo, baja confianza y recompra confirmada.

## Detalle De Cliente

- Crear una ruta nueva para el single de cliente sin reemplazar el listado existente.
- Incluir tabs `Perfil`, `Pedidos` y `WhatsApp`.
- `Perfil` muestra datos actuales del cliente y estado WhatsApp.
- `Pedidos` lista pedidos asociados con estado, items, canal, pago, total y link de edicion cuando aplique.
- `WhatsApp` lista conversaciones y mensajes asociados al cliente.

## Reglas De Seguridad

- No crear chatbot libre o generalista.
- OpenRouter devuelve JSON estructurado, no texto libre.
- La IA no inventa precios, stock, fechas de entrega, zonas, descuentos ni condiciones comerciales.
- Supabase/ERP es la fuente de verdad.
- Crear pedido solo despues de confirmacion explicita del cliente.
- Opt-out marca baja, cancela cola pendiente y envia confirmacion.
- Reclamos, baja confianza o ambiguedad importante derivan a humano.
