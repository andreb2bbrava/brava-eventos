-- Sprint UX 1.4
-- Ajustes de estrutura para eventos

alter table public.eventos
  add column if not exists descricao text,
  add column if not exists inicio_evento timestamptz,
  add column if not exists termino_evento timestamptz,
  add column if not exists maps_url text,
  add column if not exists banner_url text;

create index if not exists idx_eventos_inicio_evento
  on public.eventos (inicio_evento);
