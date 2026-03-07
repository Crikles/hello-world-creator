

## Plano: Corrigir contagem de etapas em Envios

### Problema
A query `totalEventos` em `src/pages/Envios.tsx` faz `SELECT count(*)` de todos os eventos do template, ignorando as configurações de ativação (NF-e, Falha na Entrega). Resultado: mostra 11 etapas quando deveria mostrar 8 (ou 7 sem NF-e).

### Solução
Alterar a query de `totalEventos` para buscar os eventos completos + a config da loja, e filtrar no cliente usando a mesma lógica da aba Postagens:

```typescript
// Buscar config + eventos, filtrar no cliente
const falhaLabels = ["Falha Entrega", "Reenvio Pago", "Reenvio Saiu"];

const filtered = eventos.filter(e => {
  if (!config.ativar_falha_entrega && falhaLabels.includes(e.status_label)) return false;
  if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
  return true;
});

return filtered.length;
```

### Arquivo alterado
- `src/pages/Envios.tsx` — query `total-eventos` (linhas 184-202)

