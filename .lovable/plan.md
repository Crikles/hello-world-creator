

# SMS e WhatsApp com domínio dinâmico (Jadlog vs JL)

## Problema
O link de rastreio no SMS e WhatsApp está hardcoded para `rastreio.logisticajltransportes.com`. Envios via JADLOG precisam usar `rastreio.centrojadlog.com`, igual já acontece nos e-mails.

## Solução

### 1. `send-sms/index.ts`
- Adicionar `loja_id` na query do envio (já recebe no body)
- Buscar `logistica_provider` da loja OU detectar via `transportadora` (como o email faz: `transportadora.includes("JADLOG")`)
- Alternar o domínio do link: `rastreio.centrojadlog.com` para Jadlog, `rastreio.logisticajltransportes.com` para os demais

### 2. `advance-shipments/index.ts` (WhatsApp)
- Linha 722: o `trackingUrl` está hardcoded. Usar a mesma lógica: checar `shipment.transportadora` para determinar o domínio correto

### Lógica (ambos os arquivos)
```typescript
const isJadlog = shipment.transportadora?.toUpperCase().includes("JADLOG");
const baseUrl = isJadlog
  ? "https://rastreio.centrojadlog.com"
  : "https://rastreio.logisticajltransportes.com";
const link = `${baseUrl}/r/${code}`;
```

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-sms/index.ts` | Buscar transportadora do envio e usar domínio dinâmico |
| `supabase/functions/advance-shipments/index.ts` | Linha ~722: trackingUrl dinâmico baseado na transportadora |

