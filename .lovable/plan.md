

## Correção: SMS com URL dinâmica por transportadora

### Problema
A Edge Function `send-sms` busca o campo `transportadora` do envio mas **não o utiliza**. Sempre usa a URL base da `system_config` (JL Transportes), mesmo para envios da VETOR.

### Solução
Atualizar a função `send-sms` para determinar o domínio de rastreio com base na transportadora do envio:

**Arquivo:** `supabase/functions/send-sms/index.ts`

Substituir o trecho que busca `tracking_base_url` da `system_config` por uma lógica que verifica a transportadora:

```typescript
// Determinar domínio baseado na transportadora
const transportadora = (envio.transportadora || "").toLowerCase();
const isVetor = transportadora.includes("vetor") || 
                (code && code.toUpperCase().endsWith("VT"));

const baseUrl = isVetor 
  ? "https://vetortransportesltda.com"
  : "https://rastreio.jltransportelogistica.com";

const link = `${baseUrl}/r/${code}`;
```

Isso remove a dependência da `system_config` para a URL base e usa a mesma lógica de detecção de transportadora já usada no frontend (`domain-config.ts` e sufixo "VT").

### Resultado
- Envios da VETOR → link com `vetortransportesltda.com`
- Envios da JL → link com `rastreio.jltransportelogistica.com`
- Detecção dupla: campo `transportadora` + sufixo do código de rastreio

