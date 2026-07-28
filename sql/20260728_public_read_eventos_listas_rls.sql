-- =====================================================
-- Leitura publica controlada para paginas de evento/lista
-- Permite apenas SELECT anon em eventos ativos e listas publicas ativas.
-- =====================================================

alter table public.eventos enable row level security;
alter table public.listas_evento enable row level security;

drop policy if exists eventos_select_anon_ativos on public.eventos;
create policy eventos_select_anon_ativos
on public.eventos
for select
to anon
using (ativo = true);

drop policy if exists listas_evento_select_anon_publicas_ativas on public.listas_evento;
create policy listas_evento_select_anon_publicas_ativas
on public.listas_evento
for select
to anon
using (
  ativa = true
  and lower(trim(coalesce(tipo_visibilidade, ''))) = 'publica'
  and exists (
    select 1
    from public.eventos e
    where e.id = listas_evento.evento_id
      and e.ativo = true
  )
);
