## Diagnóstico

No painel **Postagens**, o switch rotulado como **"SMS"** (`src/pages/Postagens.tsx`) está bound em `localConfig.ativar_site_rastreio`. Ou seja, "Enviar SMS ativo" = `postagem_config.ativar_site_rastreio = true`.

No `advance-shipments` (linhas 1082-1121), o disparo de SMS é gateado por **4 condições** — e duas delas estão erradas:

1. `isAtivo` — calculado nas linhas 983-995. Para eventos normais isso resolve para `config.enviar_emails`. **Bug:** uma loja que tem SMS ligado mas e-mail desligado nunca dispara SMS, mesmo com a flag de SMS ON.
2. `config.ativar_site_rastreio` — correto, é o toggle do SMS.
3. `cliente_telefone` presente — correto.
4. `nextEvent.enviar_nfe_pdf === false` — correto (evento NF-e é só e-mail).

Resultado prático observado nos logs e na base:
- 13 lojas, só **4 com a flag ON** (Magalu, use one fit, OLX, Use Essence).
- Últimas 24h: 4 envios processados, **todos skipados corretamente** porque pertencem a lojas com flag OFF.
- Não há registros recentes de SMS efetivamente disparado nem falhas — falta amostra real para auditar, mas o gate `isAtivo` provavelmente bloqueia silenciosamente envios das lojas com SMS-on/e-mail-off.

Também não existe tabela de log de SMS, então hoje é impossível auditar "quantos avanços tiveram SMS". Vamos criar uma.

## Mudanças

### 1. `supabase/functions/advance-shipments/index.ts` — corrigir gate SMS
- Remover dependência de `isAtivo` para SMS. Substituir o bloco das linhas 1082-1121 por:
  - Pré-requisitos: `config.ativar_site_rastreio === true`, `shipment.cliente_telefone` não vazio, `nextEvent.enviar_nfe_pdf === false`.
  - Logs claros: `[SMS] Skip envio X: sms toggle OFF | no phone | nfe-only event | insufficient balance`.
  - Manter débito de `custo_sms_rastreio` via `debit_user_credits`.
  - Após `invoke("send-sms")`, gravar resultado em `sms_log` (nova tabela, item 3).
  - Se `smsErr`, fazer `refund_user_credits` do custo debitado.

### 2. `supabase/functions/send-sms/index.ts`
- Após chamada à API IntegraX, retornar `provider_response`, `provider_status` para que o caller possa logar.

### 3. Nova tabela `public.sms_log` (migration)
Campos: `id uuid pk`, `envio_id uuid fk envios`, `loja_id uuid`, `user_id uuid`, `evento_id uuid null`, `status_label text`, `status text` (`sent|failed|skipped`), `motivo text null`, `telefone text`, `custo numeric`, `provider_response jsonb`, `created_at timestamptz default now()`.
- Índices: `(loja_id, created_at desc)`, `(envio_id)`.
- GRANT `SELECT, INSERT` para `authenticated` (leitura via RLS por loja), `ALL` para `service_role`.
- RLS: dono da loja pode SELECT (`user_owns_loja(auth.uid(), loja_id)`); admin pode tudo via `has_role`.

### 4. Backfill — `supabase/functions/backfill-sms` (nova edge function)
- Body: `{ loja_id?: uuid, hours?: number (default 72) }`. Sem `loja_id` = todas com flag ON.
- Para cada envio nas lojas alvo cujo `ultimo_evento_ordem > 0`, `cliente_telefone` presente, e que **não tem registro `sent` em `sms_log` para o evento atual**, dispara `send-sms` com o `status_label` do evento atual e grava em `sms_log`.
- Throttle: 200ms entre chamadas, máximo 500 envios por execução.
- Apenas usuário admin pode invocar (verificar JWT + `has_role`).

### 5. Disparo de teste manual (você pediu)
- Executar `backfill-sms` com `{ loja_id: "be5a3623-...", hours: 168 }` (Use Essence — única loja ativa com envio recente com telefone) e exibir o resultado em chat.
- Em paralelo, chamar `send-sms` direto no envio mais recente dela para validar end-to-end (com confirmação sua antes, já que envia SMS real).

## Fora do escopo
- Não criar coluna `enviar_sms` separada nem mexer no UI de Postagens — a flag `ativar_site_rastreio` continua sendo o toggle de SMS, conforme está hoje.
- Não alterar template/conteúdo de SMS nem custos.
- Não tocar em WhatsApp/e-mail.

## Validação
1. Rodar `supabase--curl_edge_functions` em `backfill-sms` para `loja_id` da Use Essence (1 envio com tel) e mostrar log.
2. Confirmar inserção em `sms_log` e cobrança em `creditos_transacoes`.
3. Próximo ciclo do cron `advance-shipments`: confirmar que envios das 4 lojas ON disparam SMS sem o bloqueio de `isAtivo`.
4. Rodar SQL para mostrar quantos SMS foram disparados nas últimas 24h após a correção.
