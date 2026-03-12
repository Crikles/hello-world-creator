

# Corrigir filtros de status na página de Envios

## Mudanças em `src/pages/Envios.tsx`

### 1. Substituir `statusOptions` (linhas 60-69)
Usar os nomes exatos dos eventos do template como valores:

```typescript
const statusOptions = [
  { value: "Pendente", label: "Pendente" },
  { value: "Postado", label: "Postado (NF-e)" },
  { value: "Coletado", label: "Coletado" },
  { value: "Em Trânsito", label: "Em Trânsito" },
  { value: "Centro Local", label: "Centro Local" },
  { value: "Taxação", label: "Taxação" },
  { value: "Pgto. Confirmado", label: "Pgto. Confirmado" },
  { value: "Saiu para Entrega", label: "Saiu para Entrega" },
  { value: "Falha Entrega", label: "Falha Entrega" },
  { value: "Reenvio Pago", label: "Reenvio Pago" },
  { value: "Reenvio Saiu", label: "Reenvio Saiu" },
  { value: "Entregue", label: "Entregue" },
];
```

### 2. Atualizar `statusLabels` e `statusColors` (linhas 38-58)
Adicionar entries para os novos status labels (Postado, Falha Entrega, Reenvio Pago, Reenvio Saiu) com cores apropriadas.

### 3. Atualizar lógica de filtro (linha 513)
Comparar com `status_label` em vez de `status`:

```typescript
const matchStatus = filterStatus === "todos"
  || e.status_label === filterStatus
  || (filterStatus === "Pendente" && e.status === "pendente" && !e.status_label);
```

### 4. Alargar SelectTrigger
De `w-[120px]` para `w-[160px]`.

