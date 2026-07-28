-- =====================================================
-- Promocao pontual de usuario para platform_owner
-- Nao executa automaticamente. Execute apenas um bloco.
-- =====================================================

-- Opcao 1: promover por email (recomendado)
-- update public.usuarios
-- set role = 'platform_owner'
-- where email = 'SEU_EMAIL_AQUI@dominio.com';

-- Opcao 2: promover por id
-- update public.usuarios
-- set role = 'platform_owner'
-- where id = '00000000-0000-0000-0000-000000000000';

-- Verificacao
-- select id, nome, email, role
-- from public.usuarios
-- where role = 'platform_owner';
