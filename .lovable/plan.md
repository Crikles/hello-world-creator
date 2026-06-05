## Problema

Na timeline do site de rastreio (padrão Correios e variantes), os eventos das etapas finais — quando o pedido se aproxima do destinatário — não estão exibindo a **cidade/UF do cliente**. Aparece apenas a cidade de origem (Goiânia/GO, configurada pelo lojista em Postagens) nos eventos iniciais, e os eventos posteriores ficam sem localização ou mostram apenas o `status_label` repetido.

Causa: o `switch (ev.status_label)` em `src/pages/Rastreio.tsx` cobre apenas alguns rótulos genéricos (`Postado`, `Coletado`, `Em Trânsito`, `Centro Local`, `Saiu para Entrega`, `Entregue`). Os rótulos reais do template ATLAS (`Chegou perto de você`, `Em redistribuição`, `Unidade final`, `Chegou ao estado vizinho`, `Passando por centro de triagem`, `Saiu da unidade de origem`, etc.) caem no `default` e não recebem a cidade do destino.

## Solução

Ampliar o mapeamento de `status_label → locationText` nos três blocos de timeline do `src/pages/Rastreio.tsx` (linhas ~663, ~937, ~1186), seguindo o padrão dos Correios. Cada etapa passará a mostrar a cidade correta (origem vs. destino) conforme o avanço do pedido.

### Mapeamento proposto

| status_label | Texto exibido |
|---|---|
| NF-e / Nota Fiscal Emitida | (sem localização) |
| Postado | `Unidade de Postagem, {origem}` |
| Coletado | `Unidade de Tratamento, {origem}` |
| Saiu da unidade de origem | `de Unidade de Tratamento, {origem} para Unidade de Distribuição, {destino}` |
| Passando por centro de triagem | `Centro de Triagem, {origem}` |
| Chegou ao estado vizinho | `Em trânsito para {destino}` |
| Chegou perto de você | `Unidade de Distribuição, {destino}` |
| Em redistribuição | `Unidade de Distribuição, {destino}` |
| Unidade final | `Unidade de Distribuição, {destino}` |
| Saiu para Entrega (e 2ª tentativa / Em rota final) | `Unidade de Distribuição, {destino}` |
| Retornou ao centro de distribuição | `Unidade de Distribuição, {destino}` |
| Entrega reprogramada | `Unidade de Distribuição, {destino}` |
| Entregue ✅ | `Pela Unidade de Distribuição, {destino}` |
| Em Trânsito / Em Rota (genérico) | `de {origem} para {destino}` |

`{origem}` = cidade/UF configurada pelo lojista em Postagens (já carregada em `origem.cidade`/`origem.estado`).
`{destino}` = `envio.cliente_cidade` + `envio.cliente_estado` (já disponíveis no objeto `envio`).

Se a cidade do cliente estiver ausente, o texto cai de volta para um genérico (sem quebrar nada).

## Detalhes técnicos

- Arquivo único alterado: `src/pages/Rastreio.tsx`.
- Trocar os três blocos `switch (ev.status_label)` por uma única função helper `buildLocationText(statusLabel, origemLabel, destLabel)` declarada no topo do componente, evitando duplicação.
- Sem mudanças de schema, backend ou edge functions.
- Sem impacto em e-mails/SMS — apenas a página pública de rastreio.
