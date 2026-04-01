

## Plan: Envio instantâneo — remover delay e disparar SMS no webhook

### Situação atual

- O webhook `webhook-recovery` já dispara o email imediatamente (linha 176), mas **não dispara o SMS**.
- A UI tem um campo "Delay (minutos)" na configuração que não faz sentido se o envio é instantâneo.
- A coluna `delay_minutos` existe na tabela `recovery_config` mas não é usada no fluxo real.

### O que será feito

1. **`webhook-recovery/index.ts`** — Adicionar disparo instantâneo de SMS logo após o email (invocar `send-recovery-sms` com o `lead_id` do lead recém-inserido)
   - Ajustar o insert para retornar o `id` do lead criado
   - Invocar `send-recovery-sms` com `{ lead_id, loja_id, tipo }`

2. **`src/pages/RecuperacaoVendas.tsx`** — Remover o campo "Delay (minutos)" da UI, já que o envio é sempre instantâneo
   - Substituir por um badge/texto informativo: "⚡ Envio instantâneo — disparado assim que o lead chega"

### Arquivos alterados
- `supabase/functions/webhook-recovery/index.ts`
- `src/pages/RecuperacaoVendas.tsx`

