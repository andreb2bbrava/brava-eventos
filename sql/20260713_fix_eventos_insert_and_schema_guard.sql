-- Guard rails para criacao de eventos (schema + RLS de insert)

alter table public.eventos
  add column if not exists descricao text,
  add column if not exists inicio_evento timestamptz,
  add column if not exists termino_evento timestamptz,
  add column if not exists maps_url text,
  add column if not exists banner_url text;

-- Compatibilidade com estruturas antigas: se inicio_evento existir e data_evento estiver nulo,
-- preenche data_evento para manter o fluxo legado da home/admin.
update public.eventos
set data_evento = (inicio_evento at time zone 'utc')::date
where data_evento is null
  and inicio_evento is not null;

alter table public.eventos enable row level security;

drop policy if exists eventos_insert_super_admin_produtor on public.eventos;

create policy eventos_insert_super_admin_produtor
on public.eventos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and (
        u.role = 'super_admin'
        or (u.role = 'produtor' and public.eventos.criador_id = auth.uid())
      )
  )
);
