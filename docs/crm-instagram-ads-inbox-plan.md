# Instagram Ads Inbox Para CRM

## Resumen

Crear el modulo `CRM > Instagram Ads Inbox` para recibir y gestionar DMs iniciados desde campanas Click to Message / Instagram Direct usando la API oficial de Meta, no scraping.

La primera version se limita a Fase 1:

- migracion Supabase
- worker Railway con webhook Meta
- guardado de payloads crudos
- creacion de conversaciones y mensajes inbound
- UI simple de inbox en modo solo lectura

## Fase 1

- Crear branch `feat/crm-instagram-ads-inbox`.
- Agregar `supabase/instagram_ads_inbox.sql` y reflejarlo en `supabase/schema.sql`.
- Crear tablas:
  - `instagram_conversations`
  - `instagram_messages`
  - `instagram_webhook_events`
  - `instagram_leads`
  - `instagram_automation_logs`
- Agregar campos de identidad Instagram en `customers`.
- Agregar `instagram_ai` a `sales_channel`.
- Crear `services/instagram-worker` con:
  - `GET /health`
  - `GET /webhooks/meta`
  - `POST /webhooks/meta`
- Guardar payloads crudos y deduplicar eventos/mensajes.
- Crear `src/lib/instagram/queries.ts`.
- Crear `/panel/crm/instagram` como inbox de solo lectura.
- Agregar item `Instagram` bajo `CRM`.

## Meta App Setup

- App: `Paltas La Candelaria CRM-IG`.
- Cuenta: `@paltaslacandelaria`.
- Webhook callback: `https://<instagram-worker-railway-url>/webhooks/meta`.
- Verify token: valor de `META_VERIFY_TOKEN`.
- Eventos minimos:
  - `messages`
  - `messaging_postbacks`
- Eventos opcionales posteriores:
  - `message_reactions`
  - `messaging_seen`

Variables Railway:

```env
META_APP_ID=""
META_APP_SECRET=""
META_VERIFY_TOKEN=""
META_PAGE_ACCESS_TOKEN=""
META_GRAPH_API_VERSION="v23.0"
META_INSTAGRAM_ACCOUNT_ID=""
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
OPENROUTER_API_KEY=""
ENABLE_INSTAGRAM_AUTOMATION="false"
PORT="8080"
```

## Fases Posteriores

- Fase 2: respuesta manual desde CRM via API oficial de Meta, guardando outbound y errores.
- Fase 3: clasificacion de intencion con OpenRouter y sugerencias de respuesta, sin autoenvio por defecto.
- Fase 4: automatizacion limitada con `ENABLE_INSTAGRAM_AUTOMATION`, ventana de 24h, handoff humano y reglas estrictas de precio, stock y zona.
- Fase 5: atribucion de campanas/adsets/ads, dashboard simple de leads y creacion de pedidos desde conversacion.

## Reglas

- No enviar mensajes outbound si el usuario no inicio la conversacion.
- No responder automaticamente en Fase 1.
- No enviar DMs masivos ni outbound frio.
- No inventar precios, stock, zonas, fechas ni promociones.
- Guardar payload crudo de Meta antes de procesar.
- Soportar reintentos de Meta sin duplicar mensajes.
- Marcar como humano cualquier audio, imagen, reclamo, tema sensible o baja confianza cuando se agregue IA.

## Test Plan

- `npm run build`.
- Verificar `GET /webhooks/meta` con token correcto e incorrecto.
- Enviar payload fixture de Meta a `POST /webhooks/meta`.
- Confirmar guardado en `instagram_webhook_events.raw_payload`.
- Confirmar deduplicacion por `event_id` o `external_message_id`.
- Confirmar creacion/actualizacion de `instagram_conversations`.
- Confirmar creacion de `instagram_messages` inbound.
- Confirmar que `/panel/crm/instagram` renderiza sin datos y con datos fixture.
- Confirmar que no se envia ninguna respuesta automatica con `ENABLE_INSTAGRAM_AUTOMATION=false`.
