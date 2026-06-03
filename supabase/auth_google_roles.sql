alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

comment on column public.profiles.email is
  'Email autorizado para Google SSO. Debe coincidir con el correo del usuario autenticado.';
