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
- [Plan CRM WhatsApp](./docs/crm-whatsapp-plan.md)
- [Modelo de catalogo](./docs/catalog-model.md)
- [Roadmap MVP](./docs/mvp-roadmap.md)
- [Modelo de datos](./docs/data-model.md)

## Siguientes pasos

1. Instalar dependencias
2. Conectar Supabase
3. Implementar autenticacion
4. Construir flujo `pedido publico -> confirmacion interna -> entrega -> cobro`
5. Probar esta semana con familia, revendedores y algunos clientes

## Auth interna

El acceso interno ahora queda asi:

- `GET /panel/**`: solo `admin`, `seller`, `collector`
- `GET /driver`: solo `admin`, `driver`
- `POST /api/panel/**`: solo `admin`, `seller`, `collector`
- `POST /api/driver/**`: solo `admin`, `driver`

### Google SSO con Supabase

1. En Supabase, habilitar `Authentication -> Providers -> Google`
2. Configurar en Google Cloud el OAuth consent screen y un client OAuth web
3. Cargar en Google como redirect URI:
   - `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
4. Cargar en Supabase las credenciales de Google
5. Ejecutar estas SQL:
   - `supabase/schema.sql`
   - `supabase/rls.sql`
   - `supabase/auth_google_roles.sql`
6. Pre-registrar cada usuario interno en `public.profiles` con su email real de Google

Ejemplo:

```sql
insert into public.profiles (email, full_name, role, active)
values
  ('dueno@lacandelaria.com', 'Juan Perez', 'admin', true),
  ('ventas@lacandelaria.com', 'Maria Lopez', 'seller', true),
  ('reparto@lacandelaria.com', 'Carlos Gomez', 'driver', true);
```

En el primer login exitoso, la app enlaza `profiles.auth_user_id` automaticamente con ese usuario de Supabase Auth.

## CRM WhatsApp

El modulo `CRM > WhatsApp` agrega una bandeja, cola de mensajes, automatizaciones y configuracion comercial para comunicaciones transaccionales con clientes existentes.

Arquitectura inicial:

- Next.js renderiza el panel y expone APIs internas/admin.
- Supabase guarda conversaciones, mensajes, cola y opt-out.
- Railway corre `services/whatsapp-worker` con `whatsapp-web.js`.
- OpenRouter solo interpreta intencion y devuelve JSON estructurado.
- El worker crea pedidos llamando a `POST /api/internal/whatsapp/orders` con `INTERNAL_API_SECRET`.

Variables adicionales:

```env
INTERNAL_API_SECRET="CHANGE_ME_INTERNAL_API_SECRET"
WHATSAPP_WORKER_URL="https://your-railway-worker.up.railway.app"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
OPENROUTER_MAX_TOKENS="700"
OPENROUTER_MODEL="openai/gpt-4.1-mini"
WHATSAPP_SESSION_PATH="/data/whatsapp-session"
APP_API_URL="https://your-next-app.example.com"
PORT="8080"
WORKER_CRON_TIMEZONE="America/Argentina/Buenos_Aires"
```

Railway:

1. Crear un servicio apuntando a `services/whatsapp-worker`.
2. Mantener el `Dockerfile` del worker para instalar las librerias de Chromium requeridas por Puppeteer.
3. Configurar un volumen persistente y usarlo en `WHATSAPP_SESSION_PATH`.
4. Cargar variables de entorno.
5. Iniciar con `npm start`.
6. Escanear el QR que aparece en logs la primera vez.
   Si el QR de logs se ve deformado, abrir `https://WORKER_URL/admin/qr?secret=INTERNAL_API_SECRET`.

Reglas operativas:

- No usar como chatbot generalista.
- No enviar masivo ni insistir si el cliente no responde.
- Respetar `customers.whatsapp_opt_in` y `whatsapp_opt_out_at`.
- Reclamos, baja confianza, ambiguedad o preguntas comerciales sensibles quedan en `needs_human`.
- Precios, stock, zonas y fechas disponibles deben venir del ERP/Supabase.
- Crear pedidos solo despues de confirmacion explicita y usando la API interna.

## CRM Instagram Ads Inbox

El modulo `CRM > Instagram` agrega una bandeja de solo lectura para DMs iniciados por usuarios desde campanas Click to Message / Instagram Direct. Usa la API oficial de Meta y no envia respuestas automaticas en Fase 1.

Arquitectura inicial:

- Next.js renderiza el panel `CRM > Instagram`.
- Supabase guarda conversaciones, mensajes inbound, leads, logs y payloads crudos de webhooks.
- Railway corre `services/instagram-worker`.
- Meta verifica y envia webhooks a `GET/POST /webhooks/meta`.
- `ENABLE_INSTAGRAM_AUTOMATION=false` mantiene IA y auto-respuestas apagadas.

Variables adicionales del worker:

```env
META_APP_ID="YOUR_META_APP_ID"
META_APP_SECRET="YOUR_META_APP_SECRET"
META_VERIFY_TOKEN="CHANGE_ME_VERIFY_TOKEN"
META_PAGE_ACCESS_TOKEN="YOUR_PAGE_ACCESS_TOKEN"
META_GRAPH_API_VERSION="v23.0"
META_INSTAGRAM_ACCOUNT_ID="YOUR_IG_ACCOUNT_ID"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
ENABLE_INSTAGRAM_AUTOMATION="false"
PORT="8080"
```

Meta:

1. Usar la app `Paltas La Candelaria CRM-IG`.
2. Vincular Facebook Page e Instagram profesional `@paltaslacandelaria`.
3. Configurar callback `https://WORKER_URL/webhooks/meta`.
4. Usar `META_VERIFY_TOKEN` como verify token.
5. Suscribir `messages` y `messaging_postbacks`.
6. Mantener la app en modo propio/testers hasta validar el flujo antes de App Review.
