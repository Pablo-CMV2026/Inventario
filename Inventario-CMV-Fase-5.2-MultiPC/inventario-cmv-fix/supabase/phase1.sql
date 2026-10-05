-- Inventario CMV — Fase 1
-- Fundación de autenticación y roles. No crea todavía tablas de inventario.

create type public.app_role as enum ('superadmin', 'inventory_admin', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id),
  deactivation_reason text
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER evita recursión de RLS al consultar el rol del usuario actual.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active = true;
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create policy "Usuarios activos pueden leer perfiles"
on public.profiles for select
to authenticated
using (public.current_app_role() is not null);

create policy "Superadmin puede actualizar perfiles"
on public.profiles for update
to authenticated
using (public.current_app_role() = 'superadmin')
with check (public.current_app_role() = 'superadmin');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

-- IMPORTANTE
-- 1) Crear usuarios desde Supabase Authentication > Users. No habilitar registro público.
-- 2) Después de crear el primer usuario, convertirlo en superadmin manualmente una sola vez:
--    update public.profiles set role='superadmin', full_name='Pablo Novoa' where email='TU_CORREO';
-- 3) Crear a Rodrigo y asignar inventory_admin.
-- 4) No eliminar usuarios históricos; desactivarlos con is_active=false.
