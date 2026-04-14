

## Plano: Migrar pagamento PIX de Woovi para CyberPay

### Contexto
A CyberPay usa endpoint `POST /payments/transactions` com `X-API-Key` no header. O valor é em **reais** (não centavos). A resposta retorna `pix.qrCode.emv` (copia e cola) e `pix.qrCode.image` (QR code). O status de pagamento pode ser verificado via `GET /payments/transactions/{id}` — quando pago, retorna `status: "APPROVED"`.

A documentação fornecida não inclui seção de webhooks, então usaremos **polling server-side** para detectar pagamentos.

### Alterações

**1. Secret: `CYBERPAY_API_KEY`**
- Solicitar ao usuário a API Key da CyberPay via `add_secret`

**2. `supabase/functions/create-pix-payment/index.ts`**
- Trocar chamada OpenPix por CyberPay: `POST https://api.escalecyber.com/v1/payments/transactions`
- Header `X-API-Key` em vez de `Authorization`
- Enviar `amount` em reais (dividir `amount_cents / 100`)
- Capturar da resposta: `data.id` (transaction ID), `data.pix.qrCode.emv` (copia e cola), `data.pix.qrCode.image` (QR image)
- Salvar no `pix_payments` com os novos campos mapeados

**3. Nova Edge Function: `check-pix-payment/index.ts`**
- Recebe `paymentId` (ID do registro em `pix_payments`)
- Busca o `transaction_id` no banco
- Faz `GET https://api.escalecyber.com/v1/payments/transactions/{transaction_id}` com `X-API-Key`
- Se `status === "APPROVED"`: executa toda a lógica de creditação (mesma do webhook-woovi atual — marcar PAID, adicionar moedas, comissão de indicação, webhooks de notificação)
- Se não aprovado: retorna status atual sem alterar nada
- Proteção de idempotência: só processa se `pix_payments.status === 'PENDING'`

**4. `src/pages/Moedas.tsx`**
- Alterar o polling: em vez de consultar apenas a tabela `pix_payments`, chamar a Edge Function `check-pix-payment` que verifica diretamente na CyberPay e credita automaticamente
- Manter o intervalo de 5s e limite de 15 minutos

**5. `webhook-woovi`**
- Manter intacto por segurança (pagamentos antigos pendentes podem ainda receber callback)
- Não será mais chamado para novos pagamentos

### Fluxo novo
```text
Frontend → create-pix-payment → CyberPay API → QR Code exibido
Frontend polling (5s) → check-pix-payment → GET CyberPay → APPROVED? → credita moedas → retorna "paid"
```

### Impacto
- Pagamentos novos usam CyberPay
- Pagamentos antigos via Woovi continuam funcionando (webhook mantido)
- Sem alteração no banco de dados (mesma tabela `pix_payments`)

