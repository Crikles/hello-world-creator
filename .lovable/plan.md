

# Correção: NF-e não anexada ao email

## Problema Identificado

A NF-e não está sendo anexada porque muitos envios (450 de 800) têm `empresa_id = NULL`. O código atual busca os dados da empresa via `select("*, empresas(*)")` que depende do FK `empresa_id`. Quando esse campo é nulo, `shipment.empresas` retorna `null` e a geração do PDF é silenciosamente pulada — o email é enviado, mas sem o anexo.

Existe uma empresa cadastrada para cada loja, mas o vínculo no envio não foi preenchido.

## Solução

Adicionar um fallback em **3 arquivos** para buscar a empresa pela `loja_id` quando `empresa_id` for nulo:

### 1. `src/lib/email-trigger.ts` (client-side trigger)
Após buscar o shipment, se `shipment.empresas` for null, fazer uma query adicional:
```typescript
if (!shipment.empresas && shipment.loja_id) {
  const { data: fallbackEmpresa } = await supabase
    .from("empresas").select("*").eq("loja_id", shipment.loja_id).maybeSingle();
  if (fallbackEmpresa) shipment.empresas = fallbackEmpresa;
}
```

### 2. `supabase/functions/advance-shipments/index.ts` (cron server-side)
Mesmo fallback na função `advanceShipment` após o `select("*, empresas(*)")`.

### 3. `supabase/functions/send-email/index.ts`
Verificar se a mesma lógica de busca do evento NF-e é impactada (provável que não, pois o send-email recebe o `nfe_storage_path` pronto).

### 4. Migration: preencher `empresa_id` nos envios existentes
```sql
UPDATE envios e
SET empresa_id = emp.id
FROM empresas emp
WHERE e.empresa_id IS NULL
  AND emp.loja_id = e.loja_id;
```

Isso corrige os 450 envios sem vínculo e garante que envios futuros que cheguem sem `empresa_id` ainda consigam gerar a NF-e.

