## Ocultar "Nota Fiscal Emitida" nos sites de rastreio público

### Contexto

A Edge Function `rastreio-info` (usada pelas páginas públicas de rastreio JL e VETOR) retorna todos os eventos do template até a `ultimo_evento_ordem` do envio. O primeiro evento de todos os templates é **"Nota Fiscal Emitida"** (`ordem = 1`, `status_label = "Postado"`), e o usuário quer escondê-lo da timeline pública — mantendo apenas as etapas seguintes (Coletado, Encaminhado, Recebido, Em trânsito, etc.).

### Mudança

Adicionar um filtro na Edge Function `supabase/functions/rastreio-info/index.ts` que remove qualquer evento cujo `nome = 'Nota Fiscal Emitida'` da lista `eventos` retornada ao frontend, junto aos filtros já existentes (Taxação, Pago, Falha Entrega).

```ts
eventos = allEvents.filter((e) => {
  if (e.nome === "Nota Fiscal Emitida") return false; // novo
  if (e.status_label === "Taxação" || e.status_label === "Pago") return config.ativar_taxacao;
  if (e.status_label === "Falha Entrega" || e.nome === "Falha na Entrega") return config.ativar_falha_entrega;
  return true;
});
```

### Escopo / impacto

- **Afeta apenas** a exibição pública (rastreio.jltransportelogistica.com e vetortransportesltda.com) — o painel interno (Envios) e a lógica de avanço de etapas continuam considerando o evento normalmente.
- **Não altera** o banco de dados nem os templates: o evento continua existindo, apenas não é exibido na timeline pública.
- **Não interfere** em e-mails de NF-e nem na geração de DANFE.

### Arquivo alterado

- `supabase/functions/rastreio-info/index.ts` — adicionar 1 linha no filtro.
