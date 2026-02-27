

# Admin SMS - Edicao de Mensagens por Etapa

## Problema
As mensagens de SMS estao hardcoded na Edge Function `send-sms`. Para editar qualquer mensagem, e necessario alterar o codigo. O admin precisa de uma interface para gerenciar essas mensagens.

## Solucao

### 1. Nova tabela `sms_templates` (migracao SQL)

Criar tabela para armazenar os templates de SMS editaveis:

```text
sms_templates
- id (uuid, PK)
- status_key (text, unique) -- chave normalizada sem acento: "Coletado", "Postado", etc.
- status_label (text) -- label de exibicao: "Coletado", "Em Transito", etc.
- mensagem (text) -- template com placeholders {nome} e {link}
- created_at, updated_at (timestamptz)
```

RLS: admins full access, authenticated users SELECT.

Seed com os 9 templates atuais (Coletado, Postado, Em Transito, Centro Local, Taxacao, Pago, Saiu para Entrega, Em Rota, Entregue) + um template default para status desconhecidos.

### 2. Nova pagina `AdminSMS` (`src/pages/admin/AdminSMS.tsx`)

- Lista todos os templates de SMS em cards editaveis
- Cada card mostra: status_label, mensagem atual, e um textarea para editar
- Placeholders disponiveis: `{nome}` (primeiro nome do cliente) e `{link}` (link de rastreio)
- Botao salvar por card ou salvar todas alteracoes de uma vez
- Preview da mensagem com dados de exemplo

### 3. Atualizar Edge Function `send-sms`

- Buscar mensagem do banco (`sms_templates`) pelo `status_key` ao inves de usar o objeto hardcoded
- Substituir `{nome}` e `{link}` na mensagem do banco
- Fallback para mensagem generica se nao encontrar no banco

### 4. Registrar rota e menu

- Adicionar rota `/admin/sms` no `App.tsx`
- Adicionar item "SMS" no `AdminSidebar.tsx` com icone `MessageSquare`

## Detalhes Tecnicos

### Arquivos criados
1. `src/pages/admin/AdminSMS.tsx` -- pagina de gestao de SMS

### Arquivos modificados
1. `supabase/functions/send-sms/index.ts` -- buscar templates do banco
2. `src/App.tsx` -- nova rota /admin/sms
3. `src/components/admin/AdminSidebar.tsx` -- item de menu SMS

### Migracao SQL
- Criar tabela `sms_templates` com RLS
- Inserir seed data com as 9 mensagens atuais

### Placeholders na mensagem
O admin edita mensagens usando `{nome}` e `{link}` como variaveis:
```text
Ola {nome}, seu produto esta em transito. Acesse: [{link}] para acompanhar.
```
A edge function substitui esses placeholders pelos valores reais antes de enviar.
