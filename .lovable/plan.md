
# Painel Admin - Aba "Valores"

## Resumo

Criar uma nova pagina no painel administrativo para gerenciar os valores (custos em moedas) de cada servico do sistema. Atualmente esses valores estao hardcoded no codigo (1 moeda para NF-e, 1 moeda para emails, 0.25 para SMS/rastreio, 1 para taxacao, 0.15 custo por email enviado). A nova aba permitira ao admin alterar esses valores dinamicamente.

## Valores Gerenciados

| Chave | Descricao | Valor Atual (hardcoded) |
|---|---|---|
| custo_nfe_email | Nota Fiscal por email | 1 moeda |
| custo_email_rastreio | Fluxo de rastreio por email | 1 moeda |
| custo_sms_rastreio | Site de rastreio por SMS | 0.25 moedas |
| custo_taxacao | Funil de taxacao | 1 moeda |
| custo_envio_email | Custo unitario por email enviado | 0.15 moedas |

## Mudancas

### 1. Nova tabela `system_config` (migracao)

Tabela chave-valor para armazenar configuracoes globais do sistema:
- `key` (text, PK) - identificador do valor
- `value` (numeric, NOT NULL) - valor numerico
- `label` (text) - descricao amigavel
- `created_at`, `updated_at` timestamps

RLS: somente admins podem ler e escrever. Leitura publica via edge functions usando service_role.

Inserir os 5 valores padrao na migracao.

### 2. Nova pagina `src/pages/admin/AdminValores.tsx`

- Layout usando `AdminLayout`
- Cards ou tabela listando cada valor com campo editavel (input numerico)
- Botao "Salvar Alteracoes" para persistir mudancas
- Feedback com toast de sucesso/erro

### 3. Rota e sidebar

- Adicionar rota `/admin/valores` em `App.tsx`
- Adicionar item "Valores" no `AdminSidebar.tsx` com icone `DollarSign`

### 4. Atualizar consumidores dos valores

- `src/pages/Postagens.tsx`: buscar valores da tabela `system_config` em vez de usar constantes hardcoded no calculo de `custoMoedas`
- `supabase/functions/send-email/index.ts`: buscar `custo_envio_email` da tabela ao registrar o log (em vez de 0.15 fixo)

## Detalhes Tecnicos

### Migracao SQL

```text
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access system_config"
  ON public.system_config FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read system_config"
  ON public.system_config FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO public.system_config (key, value, label) VALUES
  ('custo_nfe_email', 1, 'Nota Fiscal por email'),
  ('custo_email_rastreio', 1, 'Fluxo de rastreio por email'),
  ('custo_sms_rastreio', 0.25, 'Site de rastreio (SMS)'),
  ('custo_taxacao', 1, 'Funil de taxacao'),
  ('custo_envio_email', 0.15, 'Custo unitario por email enviado');
```

### Postagens.tsx - Calculo dinamico

Buscar os valores via `useQuery` da tabela `system_config` e usar no calculo de `custoMoedas` em vez das constantes hardcoded.

### Arquivos alterados/criados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `system_config` com dados iniciais |
| `src/pages/admin/AdminValores.tsx` | Criar pagina de gestao de valores |
| `src/components/admin/AdminSidebar.tsx` | Adicionar item "Valores" |
| `src/App.tsx` | Adicionar rota `/admin/valores` |
| `src/pages/Postagens.tsx` | Usar valores dinamicos da tabela |
| `supabase/functions/send-email/index.ts` | Buscar custo do email da tabela |
