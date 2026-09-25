-- Ejecutar una sola vez en Supabase: SQL Editor > New query > pegar y Run.

create table if not exists public.participantes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  correo     text not null check (correo = lower(correo)),
  taller     text not null,
  fecha      date not null,
  creado_en  timestamptz not null default now(),
  unique (correo, taller, fecha)
);

-- Correos autorizados a entrar al panel de administración.
create table if not exists public.administradores (
  correo text primary key check (correo = lower(correo))
);

alter table public.participantes   enable row level security;
alter table public.administradores enable row level security;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from administradores
    where correo = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "admin gestiona participantes" on public.participantes;
create policy "admin gestiona participantes" on public.participantes
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "admin ve administradores" on public.administradores;
create policy "admin ve administradores" on public.administradores
  for select to authenticated
  using (public.es_admin());

-- Consulta pública: solo devuelve los diplomas del correo indicado,
-- nunca el listado completo.
create or replace function public.buscar_diplomas(p_correo text)
returns table (id uuid, nombre text, taller text, fecha date)
language sql
stable
security definer
set search_path = public
as $$
  select id, nombre, taller, fecha
  from participantes
  where correo = lower(trim(p_correo))
  order by fecha desc;
$$;

revoke all on function public.buscar_diplomas(text) from public;
grant execute on function public.buscar_diplomas(text) to anon, authenticated;

-- Cambia este correo por el tuyo (el mismo con el que crearás el usuario admin).
insert into public.administradores (correo)
values ('ingenieranairobi@gmail.com')
on conflict do nothing;
