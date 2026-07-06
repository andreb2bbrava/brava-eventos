-- EPIC 05 / Issue 5.2A
-- Estrutura dos participantes por lista

alter table public.participantes
  add column if not exists lista_id bigint references public.listas_evento(id) on delete set null;

alter table public.participantes
  add column if not exists sobrenome text,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists data_nascimento date,
  add column if not exists sexo text,
  add column if not exists cidade text,
  add column if not exists observacoes text;

create index if not exists idx_participantes_lista_id
  on public.participantes (lista_id);

create index if not exists idx_participantes_evento_lista_id
  on public.participantes (evento_id, lista_id);
