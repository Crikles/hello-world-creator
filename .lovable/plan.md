

# Corrigir cálculo de SMS — filtrar eventos desativados

## Problema
O `smsEventCount` na UI conta TODOS os eventos sem NF-e do template, ignorando se Falha na Entrega ou Taxação estão desativados. Isso faz o custo exibido ser maior que o real.

### Exemplos concretos (Nacional Padrão, 9 eventos):
- Falha OFF → deveria mostrar **5 SMS**, mostra **8**
- Falha ON → deveria mostrar **8 SMS** (correto)

### Nacional Taxação (11 eventos):
- Tax OFF + Falha OFF → deveria mostrar **5 SMS**, mostra **10**
- Tax ON + Falha ON → **10 SMS** (correto)

## Cobrança real (backend)
O SMS é cobrado por disparo individual na edge function `advance-shipments`. Os eventos Falha/Taxação/NF-e já são corretamente filtrados lá — o SMS só é cobrado quando de fato enviado. O problema é **apenas na UI** (exibição do custo estimado).

## Solução

### `src/pages/Postagens.tsx` — Filtrar `smsEventCount`

Alterar o `useMemo` do `smsEventCount` (linhas 295-298) para excluir eventos de fluxos desativados:

```typescript
const smsEventCount = useMemo(() => {
  if (!sortedActiveEventos || !localConfig) return 0;
  const falhaLabels = ["Falha Entrega", "Reenvio Pago", "Reenvio Saiu"];
  const taxLabels = ["Taxação", "Pago"];
  return sortedActiveEventos.filter(e => {
    if (e.enviar_nfe_pdf) return false; // NF-e não envia SMS
    if (falhaLabels.includes(e.status_label || "") && !localConfig.ativar_falha_entrega) return false;
    if (taxLabels.includes(e.status_label || "") && !localConfig.ativar_taxacao) return false;
    return true;
  }).length;
}, [sortedActiveEventos, localConfig]);
```

Isso usa a mesma lógica de filtragem que já existe no backend (`email-trigger.ts` linhas 78-88 e `advance-shipments`), garantindo consistência entre o que é exibido e o que é cobrado.

### Resultado esperado por template:

```text
Nacional Padrão (Falha OFF):  5 SMS
Nacional Padrão (Falha ON):   8 SMS
Nacional Taxação (Tax OFF, Falha OFF):  5 SMS
Nacional Taxação (Tax ON, Falha OFF):   7 SMS
Nacional Taxação (Tax ON, Falha ON):   10 SMS
Nacional Expressa:             2 SMS
```

