-- Brava Eventos
-- Estrutura de Staff por evento + acesso de Staff/Produtor aos eventos vinculados.
--
-- IMPORTANTE:
-- Esta migration representa alterações que já foram aplicadas manualmente
-- no banco de PRODUÇÃO em 09/09/2026.
-- Foi escrita de forma idempotente para poder ser utilizada futuramente
-- no ambiente de TESTE sem recriar objetos existentes.

begin;

-- =========================================================
-- TABELA evento_staff
-- =========================================================

create table if not exists public.evento_staff (
  id uuid not null default gen_random_uuid(),
  evento_id bigint null,
  usuario_id uuid null
);

-- Primary Key
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'evento_staff_pkey'
      and conrelid = 'public.evento_staff'::regclass
  ) then
    alter table public.evento_staff
      add constraint evento_staff_pkey primary key (id);
  end if;
end
$$;

-- FK evento
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'evento_staff_evento_id_fkey'
      and conrelid = 'public.evento_staff'::regclass
  ) then
    alter table public.evento_staff
      add constraint evento_staff_evento_id_fkey
      foreign key (evento_id)
      references public.eventos(id);
  end if;
end
$$;

-- FK usuario
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'evento_staff_usuario_id_fkey'
      and conrelid = 'public.evento_staff'::regclass
  ) then
    alter table public.evento_staff
      add constraint evento_staff_usuario_id_fkey
      foreign key (usuario_id)
      references public.usuarios(id);
  end if;
end
$$;

alter table public.evento_staff enable row level security;

grant select, insert, update, delete
on table public.evento_staff
to authenticated;

grant all
on table public.evento_staff
to service_role;

-- =========================================================
-- POLICIES evento_staff
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'evento_staff'
      and policyname = 'select_evento_staff'
  ) then
    create policy "select_evento_staff"
    on public.evento_staff
    as permissive
    for select
    to authenticated
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'evento_staff'
      and policyname = 'insert_evento_staff'
  ) then
    create policy "insert_evento_staff"
    on public.evento_staff
    as permissive
    for insert
    to authenticated
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'evento_staff'
      and policyname = 'update_evento_staff'
  ) then
    create policy "update_evento_staff"
    on public.evento_staff
    as permissive
    for update
    to authenticated
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'evento_staff'
      and policyname = 'delete_evento_staff'
  ) then
    create policy "delete_evento_staff"
    on public.evento_staff
    as permissive
    for delete
    to authenticated
    using (true);
  end if;
end
$$;

-- =========================================================
-- STAFF: pode visualizar apenas eventos aos quais está vinculado
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos'
      and policyname = 'Staff ve eventos vinculados'
  ) then
    create policy "Staff ve eventos vinculados"
    on public.eventos
    as permissive
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.evento_staff es
        where es.evento_id = eventos.id
          and es.usuario_id = auth.uid()
      )
    );
  end if;
end
$$;

-- =========================================================
-- PRODUTOR: pode visualizar eventos aos quais está vinculado
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos'
      and policyname = 'Produtor ve eventos vinculados'
  ) then
    create policy "Produtor ve eventos vinculados"
    on public.eventos
    as permissive
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.evento_produtores ep
        where ep.evento_id = eventos.id
          and ep.usuario_id = auth.uid()
      )
    );
  end if;
end
$$;

commit;
