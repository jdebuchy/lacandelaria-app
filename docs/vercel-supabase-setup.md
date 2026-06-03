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

## Google SSO

1. En `Supabase -> Authentication -> Providers -> Google`, activar el proveedor
2. En Google Cloud crear credenciales OAuth web
3. Configurar como redirect URI de Google:
   - `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
4. Configurar en `Supabase -> Authentication -> URL Configuration`:
   - Site URL: `NEXT_PUBLIC_APP_URL`
   - Additional Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `https://<tu-dominio>/auth/callback`
5. Ejecutar `supabase/auth_google_roles.sql`
6. Crear perfiles internos con email + role antes del primer login

Ejemplo:

```sql
insert into public.profiles (email, full_name, role, active)
values ('operaciones@lacandelaria.com', 'Operaciones', 'admin', true);
```

## Flujo recomendado

1. crear repo en GitHub
2. crear proyecto en Supabase
3. correr `supabase/schema.sql`
4. correr `supabase/rls.sql`
5. correr `supabase/auth_google_roles.sql`
6. importar repo en Vercel
7. cargar variables de entorno
8. desplegar preview
9. validar login Google, formulario publico y panel interno

## Primer entregable

- `/order` para captura publica
- `/backoffice` para operacion interna
- `/api/health` para validar entorno
