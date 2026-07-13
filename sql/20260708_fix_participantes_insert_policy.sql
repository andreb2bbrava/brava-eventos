-- Ajuste opcional de policy para INSERT em participantes
-- Aplicar apenas se os logs indicarem bloqueio por RLS (code 42501/PGRST301).

alter table if exists public.participantes enable row level security;

drop policy if exists participantes_insert_super_admin_produtor on public.participantes;

create policy participantes_insert_super_admin_produtor
on public.participantes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.role = 'super_admin'
  )
  or exists (
    select 1
    from public.usuarios u
    join public.evento_produtores ep
      on ep.usuario_id = u.id
    where u.id = auth.uid()
      and u.role = 'produtor'
      and ep.evento_id = participantes.evento_id
  )
);
