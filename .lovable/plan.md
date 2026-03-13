

## Plano: Migrar pagamento PIX de BlackCat para Woovi (OpenPix)

### Resumo
Substituir a integração BlackCat pela API Woovi/OpenPix para criação de cobranças PIX e recebimento de webhooks de confirmação de pagamento.

### Diferenças principais entre as APIs

| Aspecto | BlackCat | Woovi/OpenPix |
|---|---|---|
| Criar cobrança | `POST /api/sales/create-sale` | `POST /api/v1/charge` |
| Verificar status | `GET /api/sales/{id}/status` | `GET /api/v1/charge/{id}` |
| Header de auth | `X-API-Key` | `Authorization: {api_key}` |
| Valor | `amount` (centavos) | `value` (centavos) |
| QR Code | `paymentData.qrCodeBase64` | `charge.qrCodeImage` (URL da imagem) |
| Copia e Cola | `paymentData.copyPaste` | `brCode` |
| Transaction ID | `transactionId` | `charge.transactionID` |
| Webhook event | `transaction.paid` | `OPENPIX:CHARGE_COMPLETED` |

### Alterações

**1. Secret: trocar `BLACKCAT_API_KEY` por `OPENPIX_API_KEY`**
- Solicitar ao usuário a chave da API Woovi via `add_secret`

**2. `supabase/functions/create-pix-payment/index.ts`**
- Trocar `BLACKCAT_API_KEY` por `OPENPIX_API_KEY`
- Montar payload no formato Woovi: `{ correlationID: pixPayment.id, value: amount_cents, comment, customer: { name, email, phone, taxID } }`
- Chamar `POST https://api.openpix.com.br/api/v1/charge`
- Extrair `brCode` (copia e cola), `charge.qrCodeImage` (URL da imagem QR), `charge.transactionID`
- Salvar no `pix_payments` e retornar ao frontend

**3. `supabase/functions/webhook-blackcat/index.ts` → renomear para `webhook-woovi`**
- Criar nova Edge Function `webhook-woovi`
- Webhook da Woovi envia: `{ event: "OPENPIX:CHARGE_COMPLETED", charge: { correlationID, transactionID, status, value } }`
- Usar `correlationID` (nosso `pixPayment.id`) para localizar o registro
- Verificar status via `GET /api/v1/charge/{correlationID}` para validação autoritativa
- Manter toda a lógica de créditos, comissão de indicação e idempotência intacta
- Atualizar `config.toml` para incluir `webhook-woovi` com `verify_jwt = false`

**4. `src/pages/Moedas.tsx` (frontend)**
- Ajustar a interface `PixPaymentData`: o campo `qrCodeBase64` passa a ser uma URL de imagem (não mais base64)
- No QR Code: usar a URL da imagem retornada pela Woovi OU gerar QR via `brCode` (copia-cola) como já faz com a lib `qrcode`
- Sem outras mudanças necessárias — o polling por `pix_payments.status` continua igual

**5. Limpeza**
- Remover/manter `webhook-blackcat` desativado (pode deletar depois)
- Manter tabela `pix_payments` inalterada (mesma estrutura serve)

### Impacto
- Nenhuma mudança no banco de dados
- Frontend praticamente igual (só muda o campo de imagem QR)
- Toda lógica de créditos/comissões preservada

