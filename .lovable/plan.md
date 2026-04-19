
O usuário quer mudar o comportamento do último evento ("Entregue") nos envios:

1. **Não enviar mais automaticamente** — o cron/automação não deve avançar para "Entregue" sozinho.
2. **Confirmação manual** — o lojista clica num botão para marcar como entregue.
3. **Desabilitar e-mail e SMS** desse evento específico.

Preciso entender:
- Onde a automação avança o status (cron `advance-shipments` e `triggerNextEmail`).
- Como o evento "Entregue" é identificado (último `ordem` do template ou `is_final = true`).
- Onde mostrar o botão manual (provavelmente em `src/pages/Envios.tsx`).

Vou checar rapidamente.

## Plano

### 1. Bloquear avanço automático para "Entregue"
- **`src/lib/email-trigger.ts`**: dentro de `triggerNextEmail`, ao identificar o `nextEvent`, se ele for o último da lista (status final "Entregue") e `forceAdvance` for `false`, **interromper** sem avançar nem enviar e-mail/SMS.
- **`supabase/functions/advance-shipments/index.ts`**: aplicar a mesma regra no cron — pular envios cujo próximo evento é o último ("Entregue"). Assim a automação 24/7 nunca marca como entregue.

### 2. Botão manual "Marcar como Entregue"
- **`src/pages/Envios.tsx`**: adicionar ação por linha (botão/menu) "Marcar como Entregue" visível quando `status` está em `em_transito` ou `saiu_para_entrega`.
- Ao clicar: chamar `triggerNextEmail(envioId, lojaId, false, true)` com `forceAdvance=true`. Como o e-mail/SMS do evento Entregue serão desabilitados (passo 3), só o status será atualizado.
- Adicionar também ação em massa "Marcar selecionados como Entregue" (opcional, seguindo padrão das demais ações em massa).

### 3. Desabilitar e-mail e SMS no evento "Entregue"
- **`src/lib/email-trigger.ts`**: ao processar o evento final (último `ordem`), pular o `send-email` e o `send-sms` mesmo quando acionado manualmente. O `update` do status continua acontecendo, mas nenhum disparo de notificação é feito.
- **Banco** (migration): garantir consistência setando `enviar_email = false` em todos os `postagem_eventos` cujo `status_label = 'Entregue'` (ou que sejam o último `ordem` de cada template). Isso preserva o comportamento mesmo se o frontend mudar no futuro.

### 4. UX
- Badge/ícone visual no botão "Marcar como Entregue" para deixar claro que é manual.
- Toast de confirmação após marcar manualmente.

## Resultado esperado
- Automação 24/7 **nunca** avança envios para "Entregue".
- Lojista vê botão "Marcar como Entregue" em envios em trânsito / saiu para entrega.
- Ao confirmar manualmente, status muda para "entregue" **sem** enviar e-mail nem SMS.
- Cashback e demais regras pós-entrega continuam funcionando.
