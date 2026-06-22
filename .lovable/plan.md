## Objetivo

Alinhar este projeto (painel/back-end) ao spec do projeto de logística: cada envio passa a ter uma **marca** explícita, e todo link enviado ao cliente (email/SMS/WhatsApp) usa o **domínio correto da marca**, no formato `https://<dominio>/r/<codigo_rastreio>`.

## Mapeamento oficial

| Marca | Valor no banco | Domínio | Idioma | Sufixo do código |
|---|---|---|---|---|
| JET LINE | `jetline` | app.jetlinetransportes.com | PT-BR | `JL` (ex.: `BRxxxxJL`) |
| ATLAS | `atlas` | app.atlas-cargo.org | PT-BR | `AT` |
| TrackMaster US | `trackmaster_us` | us.tracker-master.com | EN | `TM` + final `US` |
| TrackMaster ES | `trackmaster_es` | es.tracker-master.com | ES | `TM` + final `ES` |

## Como a marca é decidida

- **Envio nacional** (`is_international = false`): herda da loja → `lojas.logistica_provider` (`atlas` ou `jetline`).
- **Envio global** (`is_international = true`): pelo idioma do fluxo global
  - `global_flow_lang = 'en'` (ou config padrão) → `trackmaster_us`
  - `global_flow_lang = 'es'` → `trackmaster_es`
  - `pt` em envio internacional cai em `trackmaster_us` (fallback) — confirmar abaixo.

## Mudanças

### 1. Banco
- Migration para adicionar `envios.marca text` (nullable, mas preenchida por trigger).
- Atualizar `generate_tracking_code()`:
  - Detectar marca em `BEFORE INSERT` usando `is_international` + `global_flow_lang` + `lojas.logistica_provider`.
  - Gerar sufixo conforme tabela (TM…US, TM…ES, …JL, …AT).
  - Gravar `NEW.marca` e `NEW.transportadora` coerentes.
- Backfill: preencher `marca` em envios existentes a partir do sufixo do `codigo_rastreio` atual + `is_international`.

### 2. Helper único de URL de rastreio
Criar `getTrackingUrl(marca, codigo)` em dois lugares espelhados:
- `src/lib/tracking-url.ts` (front)
- `supabase/functions/_shared/tracking-url.ts` (edge functions)

Único ponto de verdade — todo email/SMS/WhatsApp passa a importar daqui.

### 3. Edge functions que mandam link ao cliente
Trocar o domínio fixo pelo helper:
- `send-global-flow/index.ts` — hoje hardcoda `https://atlas-cargo.org/r/...` mesmo em envio internacional. Passar a usar `trackmaster_us` / `trackmaster_es` conforme `lang`.
- `send-email`, `send-sms`, `send-whatsapp`, `send-payment-confirmation`, `send-recovery-email`, `send-recovery-sms`, `auto-whatsapp-new-order`, `bulk-send-status-email`, `backfill-missed-emails`, `resend-daily-emails`, `retry-failed-sends` — auditar e trocar qualquer link `atlas-cargo.org/r/...` ou similar pelo helper baseado na `marca` do envio.
- `redirect/index.ts` (link curto) — passar a resolver o domínio destino pela `marca` do envio/pedido em vez de `BASE_URL` fixo no Atlas.

### 4. Frontend
- `src/lib/domain-config.ts`: adicionar `us.tracker-master.com` e `es.tracker-master.com` como domínios de logística reconhecidos, com `getLogisticsProvider` retornando `trackmaster_us` / `trackmaster_es`.
- Página `Global.tsx` e qualquer botão "Ver rastreio" que monta URL: usar o helper.

### 5. Validação / entrega ao outro projeto
Não precisa endpoint novo — o outro projeto lê a tabela `envios` direto. Garantimos só que:
- `codigo_rastreio` segue o padrão por marca
- `marca` está sempre preenchida
- `status`, `status_label`, `eventos`, etc. continuam atualizados em tempo real

Após implementar, gero uma amostra de 4 códigos (um por marca) para você validar manualmente nos 4 domínios.

## Perguntas rápidas antes de implementar

1. **Envio internacional com `global_flow_lang = 'pt'`** (raro mas existe) → cai em `trackmaster_us` ou `atlas`?
2. **Backfill**: reescrevo o sufixo dos códigos antigos para o novo padrão (TM…US/ES nos internacionais) ou mantenho os códigos antigos como estão e só preencho a coluna `marca`?
3. Quer que eu adicione um campo na UI da loja para **forçar manualmente** a marca de um envio (override), ou a decisão automática basta?
