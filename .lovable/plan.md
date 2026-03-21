

## Plano: Date Picker + Emails Falhados do Dia + Reenvio com 1 Click

### O que muda

1. **Filtro por data customizado**: Substituir o select de "7/30/90 dias" por um date range picker com botões de atalho (Hoje, 7d, 30d) + seleção de intervalo customizado
2. **Seção "Falhas de Hoje"**: Card destacado no topo mostrando os emails com status `failed` do dia atual, com detalhes (destinatário, etapa, loja)
3. **Botão "Reenviar Falhas do Dia"**: Um botão que chama a edge function `resend-daily-emails` existente para reprocessar todos os emails falhados do dia com 1 click, com feedback de progresso

### Alterações técnicas

**1. `src/pages/admin/AdminEmailSaude.tsx`**
- Trocar o `<Select>` de período por um date range picker (Popover + Calendar com `mode="range"`) com botões de atalho (Hoje, 7d, 30d, 90d)
- Adicionar seção "Falhas de Hoje" com query separada filtrando `status = 'failed'` e `created_at >= hoje 00:00`
- Adicionar botão "Reenviar Falhas do Dia" que:
  - Primeiro faz dry_run para mostrar quantos emails serão reenviados
  - Ao confirmar, chama `resend-daily-emails` e mostra resultado (sucesso/falha)
  - Mostra loading state durante o processo

**2. `supabase/functions/resend-daily-emails/index.ts`**
- A function já existe e funciona. Apenas ajustar para também incluir emails com status `failed` (atualmente só pega `sent`). Ou melhor: criar um modo que reenvie especificamente os `failed` do dia, não os `sent`.
- Adicionar parâmetro `mode: "failed"` que busca logs com `status IN ('failed', 'bounced')` em vez de `sent`

### Resumo
- 3 arquivos alterados: `AdminEmailSaude.tsx` (UI), `resend-daily-emails/index.ts` (suportar reenvio de falhas)
- Sem migration necessária

