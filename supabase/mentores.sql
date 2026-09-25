-- Mentora o mentor de cada taller (tercera firma del diploma).
-- Ejecutar después de schema.sql y roles.sql. Se puede volver a ejecutar sin problema.

create table if not exists public.mentores_taller (
  taller  text not null,
  fecha   date not null,
  nombre  text not null,
  titulo  text not null default 'Mentora' check (titulo in ('Mentora', 'Mentor')),
  primary key (taller, fecha)
);

alter table public.mentores_taller enable row level security;

drop policy if exists "admin ve mentores" on public.mentores_taller;
drop policy if exists "admin registra mentores" on public.mentores_taller;
drop policy if exists "admin edita mentores" on public.mentores_taller;
drop policy if exists "superadmin elimina mentores" on public.mentores_taller;

create policy "admin ve mentores" on public.mentores_taller
  for select to authenticated using (public.es_admin());
create policy "admin registra mentores" on public.mentores_taller
  for insert to authenticated with check (public.es_admin());
create policy "admin edita mentores" on public.mentores_taller
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "superadmin elimina mentores" on public.mentores_taller
  for delete to authenticated using (public.es_superadmin());

-- La consulta pública ahora también devuelve la mentora o el mentor del taller.
drop function if exists public.buscar_diplomas(text);
create function public.buscar_diplomas(p_correo text)
returns table (id uuid, nombre text, taller text, fecha date, mentor text, mentor_titulo text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.taller, p.fecha, m.nombre, m.titulo
  from participantes p
  left join mentores_taller m on m.taller = p.taller and m.fecha = p.fecha
  where p.correo = lower(trim(p_correo))
  order by p.fecha desc;
$$;

revoke all on function public.buscar_diplomas(text) from public;
grant execute on function public.buscar_diplomas(text) to anon, authenticated;
