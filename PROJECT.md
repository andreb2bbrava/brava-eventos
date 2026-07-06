# SaaS de Eventos - PROJECT.md

## Objetivo
SaaS de gestão de eventos com Next.js 16, TypeScript, Tailwind CSS e Supabase.

## Stack
- Next.js 16
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage

## Fluxo de trabalho
- O usuário atua como Product Owner.
- O ChatGPT atua como Tech Lead/Arquiteto.
- O Codex Agent atua como desenvolvedor no VS Code.
- Antes de aplicar qualquer alteração:
  - mostrar diff
  - executar npm run build
  - só aplicar após aprovação

## Roles
### super_admin
Pode ver e gerenciar tudo.

### produtor
Pode:
- ver eventos criados por ele
- ver eventos compartilhados com ele via evento_produtores
- editar eventos aos quais tem acesso
- adicionar produtores e staff

### staff
Futuro:
- ver apenas eventos vinculados
- fazer check-in
- não editar eventos

## Tabelas atuais

### usuarios
- id
- created_at
- email
- role
- criador_id

### eventos
- id bigint
- nome
- slug
- criador_id
- data_evento
- hora_evento
- local_evento
- maps_url
- banner_url
- banner_posicao
- tipo_lista
- destaque
- ativo

### participantes
- id
- nome
- whatsapp
- email
- presente
- entrada_confirmada_em
- evento_id

### evento_produtores
- id
- evento_id bigint
- usuario_id uuid

## Tipos de lista

### Lista Simples
Campos obrigatórios:
- nome
- sobrenome

Check-in:
- manual pelo dashboard

### Lista VIP
Campos obrigatórios:
- nome
- sobrenome
- email
- celular
- data_nascimento

Futuro:
- QR Code individual

## Homologações V1.0

### Concluído
- Login Super Admin
- Login Produtor
- Criação de usuários
- Criação de eventos
- Edição de eventos como Super Admin
- Compatibilidade inicial com Next.js 16
- Check-in manual funcionando

### Correção importante
Foi criada a policy:
allow_update_participantes
na tabela public.participantes
para permitir update por usuários authenticated.

## Backlog imediato

### Issue #004 - Compartilhamento de Eventos
Objetivo:
- Vincular produtores a eventos usando evento_produtores.
- Produtores vinculados devem ver o evento no /admin.
- Produtores vinculados devem poder abrir e editar esses eventos.

### Issue #005 - Staff
Objetivo:
- Criar tabela evento_staff.
- Vincular staff a eventos.
- Staff acessa apenas dashboard/check-in.

### Issue #006 - Página Pública
Objetivo:
- Ajustar formulário conforme tipo_lista.
- Simples: nome e sobrenome.
- VIP: nome, sobrenome, email, celular e data_nascimento.

## Regras de arquitetura
- Não adicionar Promoters, Hosters, QR Code ou Financeiro antes da V1.0 estar estável.
- Corrigir bugs pela causa raiz.
- Não remendar arquivos grandes sem análise.
- Preservar regras de negócio existentes.
- Manter compatibilidade com Next.js 16.
- Em Client Components, usar useParams() em vez de acessar params diretamente.
- Não usar await params em Client Components.
