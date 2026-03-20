

## Plano: Eliminar Gargalos e Garantir Fluxo 100%

### Problema Principal — Filtro SQL não entrou em vigor
Os logs de agora (15:28 UTC) **ainda mostram** "Skip envio: waiting for manual approval (Falha Entrega)" — significando que o deploy anterior **não propagou** ou a versão antiga está em cache. A função precisa ser redeployada com as correções consolidadas.

### Problemas Identificados

**1. Limite de 200 envios por execução (MAX_PER_RUN = 200)**
- Com 1.135 envios prontos para avançar, o cron precisa de ~6 ciclos (30 min) para processar tudo
- Se novos envios chegam continuamente, o backlog nunca zera

**2. Limite de 100 por loja (MAX_PER_LOJA = 100)**
- Uma loja tem 973 envios aguardando — precisa de ~10 ciclos só para essa loja

**3. Timeout da Edge Function**
- Com 500ms de delay entre cada envio, 200 envios = 100 segundos
- Cada envio faz múltiplas queries (fetch envio, fetch eventos, update, send email, SMS, WhatsApp)
- Risco real de timeout em execuções longas

**4. `resend-daily-emails` sem paginação**
- Busca logs do dia sem `.limit()` mas Supabase retorna no máximo 1000 por padrão
- Se houver mais de 1000 emails no dia, os excedentes são ignorados silenciosamente

**5. Dupla verificação de "Falha Entrega" — redundante**
- O filtro SQL (linha 430) exclui esses envios, mas o código na linha 521-525 verifica novamente e loga "Skip"
- Se o filtro SQL funcionar, esse log nunca aparece. Se não funcionar, gasta slots.

### Correções

**Arquivo 1: `supabase/functions/advance-shipments/index.ts`**
- Aumentar `MAX_PER_RUN` de 200 → 500
- Aumentar `MAX_PER_LOJA` de 100 → 300
- Reduzir `BATCH_DELAY_MS` de 500ms → 200ms (já é sequencial, o delay é desnecessário tão alto)
- Remover o check redundante de `pauseLabels` dentro de `advanceShipment()` (linhas 521-525) — já filtrado na query SQL
- Garantir que o filtro `.not("status_label", "in", ...)` está correto

**Arquivo 2: `supabase/functions/resend-daily-emails/index.ts`**
- Adicionar paginação na busca de `postagem_email_log` (loop com `.range()` em blocos de 1000) para suportar qualquer volume

**Arquivo 3: `src/lib/email-trigger.ts`**
- Remover o check redundante de `pauseLabels` (linhas 91-95) — a lógica de pausa é gerenciada pelo cron, não pelo trigger manual

### Redeploy
- Redeployar `advance-shipments` para garantir que a versão correta esteja ativa

### Impacto
- 1.135 envios prontos processados em ~2 ciclos (10 min) em vez de ~6 ciclos (30 min)
- Sem limite prático para volume diário de emails reenviados
- Redução de 60% no tempo total de processamento por ciclo

