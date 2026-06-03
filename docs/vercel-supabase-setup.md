# Vercel + Supabase setup

## Stack

- `Next.js` en `Vercel`
- `Supabase` para base de datos y auth
- `GitHub` para deploy continuo

## Variables de entorno

Definir en local y en Vercel:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Flujo recomendado

1. crear repo en GitHub
2. crear proyecto en Supabase
3. correr `supabase/schema.sql`
4. correr `supabase/rls.sql`
5. importar repo en Vercel
6. cargar variables de entorno
7. desplegar preview
8. validar formulario publico y backoffice

## Primer entregable

- `/order` para captura publica
- `/backoffice` para operacion interna
- `/api/health` para validar entorno
