-- Roles de administración. Ejecutar después de schema.sql (SQL Editor > New query > Run).
-- Se puede volver a ejecutar sin problema.
--   superadmin: todo, incluido eliminar participantes y gestionar administradoras.
--   editor:     registrar, editar e importar participantes.

alter table public.administradores
  add column if not exists rol text not null default 'editor'
  check (rol in ('superadmin', 'editor'));

create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from administradores
    where correo = lower(coalesce(auth.jwt() ->> 'email', ''))
      and rol = 'superadmin'
  );
$$;

-- Participantes: cualquier admin ve, registra y edita; solo superadmin elimina.
drop policy if exists "admin gestiona participantes" on public.participantes;
drop policy if exists "admin ve participantes" on public.participantes;
drop policy if exists "admin registra participantes" on public.participantes;
drop policy if exists "admin edita participantes" on public.participantes;
drop policy if exists "superadmin elimina participantes" on public.participantes;

create policy "admin ve participantes" on public.participantes
  for select to authenticated using (public.es_admin());
create policy "admin registra participantes" on public.participantes
  for insert to authenticated with check (public.es_admin());
create policy "admin edita participantes" on public.participantes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "superadmin elimina participantes" on public.participantes
  for delete to authenticated using (public.es_superadmin());

-- Administradoras: todas ven la lista; solo superadmin agrega, cambia o quita.
drop policy if exists "superadmin gestiona administradores" on public.administradores;
create policy "superadmin gestiona administradores" on public.administradores
  for all to authenticated
  using (public.es_superadmin())
  with check (public.es_superadmin());

-- Cambia el segundo correo por el de tu compañera (en minúsculas).
insert into public.administradores (correo, rol) values
  ('ingenieranairobi@gmail.com', 'superadmin'),
  ('idalisramirez27@gmail.com', 'editor')
on conflict (correo) do update set rol = excluded.rol;
