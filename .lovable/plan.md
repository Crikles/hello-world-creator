

## Plan: Configurar cobrança de recuperação com preços personalizáveis

### Contexto atual

Os valores estão hardcoded nas edge functions:
- `send-recovery-sms`: cobra 0.25 (linha 139)
- `send-recovery-email`: cobra 0.50 (linha 227)

### O que será feito

1. **Inserir valores padrão na `system_config`** (4 novas chaves):
   - `custo_recovery_sms_pix` = 0.15
   - `custo_recovery_sms_carrinho` = 0.15
   - `custo_recovery_email_pix` = 0.10
   - `custo_recovery_email_carrinho` = 0.10

2. **Atualizar `send-recovery-sms/index.ts`**:
   - Buscar custo da `system_config` pela chave `custo_recovery_sms_{tipo}`
   - Verificar `custom_prices` do perfil do usuário (mesma chave)
   - Usar o valor personalizado se existir, senão o global, senão fallback 0.15

3. **Atualizar `send-recovery-email/index.ts`**:
   - Mesmo padrão: buscar `custo_recovery_email_{tipo}` da `system_config`
   - Verificar `custom_prices` do perfil do usuário
   - Fallback 0.10

4. **Painel Admin** (`AdminValores.tsx`):
   - Adicionar as 4 novas chaves na interface de custos para o admin editar os valores globais
   - As chaves já serão editáveis por usuário via `custom_prices` no painel de usuários existente

### Padrão seguido

Mesmo padrão do `advance-shipments`: `system_config` → `custom_prices` override → fallback hardcoded.

### Arquivos alterados
- `supabase/functions/send-recovery-sms/index.ts`
- `supabase/functions/send-recovery-email/index.ts`
- `src/pages/admin/AdminValores.tsx` (adicionar novas chaves)
- Inserção de dados na `system_config` (4 registros)

