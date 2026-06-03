## Problema

Na página **Confirmação de Pagamento** existem dois toggles que parecem ativar a funcionalidade:

1. **Status da Funcionalidade** (topo) — toggle MASTER, persiste `ativo` no banco. Quando `false`, a edge function `send-payment-confirmation` bloqueia todo envio.
2. **Enviar email de confirmação** (no card de edição do email) — toggle redundante que persiste `enviar_email`. Confunde o lojista porque parece "ligar a função" mesmo quando o master está Desativado.

Além disso, o lojista diz que todas as contas devem vir **DESATIVADAS** por padrão. O default da coluna `ativo` já é `false`, mas há contas com `ativo=true` herdadas de configurações antigas que precisam ser zeradas.

## Mudanças

### 1. Remover o segundo toggle (frontend)
Em `src/pages/ConfirmacaoPagamento.tsx`:
- Remover o `Switch` "Enviar email de confirmação" (linha ~776) e exibir o card de Nome do Remetente / Assunto / Saudação / etc. sempre que o master `ativo` estiver ligado.
- Manter `enviar_email` sempre `true` no payload salvo (o gate real passa a ser apenas o master `ativo`).
- Remover o `useState` `enviarEmail` e o `setEnviarEmail` correspondente.
- O toggle de **SMS** continua existindo (é uma escolha de canal separada, não duplica o master).

### 2. Reset de todas as contas para Desativado (migração)
Migração SQL única:
```sql
UPDATE public.confirmacao_pagamento_config SET ativo = false;
```
O default da coluna já é `false`, então novas contas continuam nascendo desativadas. Quem quiser usar precisa ligar o master manualmente.

## Comportamento final

- Único botão de liga/desliga: **Status da Funcionalidade** no topo.
- Quando desligado: nenhum email nem SMS de confirmação sai, independente do que esteja preenchido abaixo.
- Quando ligado: envia email automaticamente; SMS só sai se o toggle de SMS estiver ligado.
- Todas as contas existentes ficam desativadas após o deploy; o lojista precisa entrar e ligar manualmente.

## Detalhes técnicos

- Arquivos tocados: `src/pages/ConfirmacaoPagamento.tsx` (remoção do toggle + ajustes de state) e uma nova migração `supabase/migrations/...sql`.
- Edge function `send-payment-confirmation` **não muda** — ela já gate por `config.ativo` corretamente.
- Não há impacto em histórico, custos, créditos ou outras telas.
