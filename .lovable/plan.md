

## Plano: Melhorar Template Prolongado com Eventos Variados

### Solução

#### 1. Redesenhar os eventos (16 eventos no total)

| Ordem | Status Label | Nome | Delay (h) |
|-------|-------------|------|-----------|
| 1 | Postado | Nota Fiscal Emitida | 0 |
| 2 | Coletado | Coletado pela Transportadora | 24 |
| 3 | Em Trânsito | Objeto encaminhado para centro de distribuição | 48 |
| 4 | Em Trânsito | Recebido na unidade de tratamento | 48 |
| 5 | Em Trânsito | Em trânsito para unidade estadual | 72 |
| 6 | Em Trânsito | Objeto encaminhado para filial regional | 48 |
| 7 | Em Trânsito | Recebido na filial regional | 120 |
| 8 | Em Trânsito | Aguardando despacho para unidade local | 96 |
| 9 | Em Trânsito | Objeto despachado para unidade local | 72 |
| 10 | Em Trânsito | Recebido na unidade de distribuição | 48 |
| 11 | Centro Local | Objeto no centro de distribuição local | 48 |
| 12 | Centro Local | Em processo de separação para entrega | 48 |
| 13 | Centro Local | Seu pedido está próximo | 48 |
| 14 | Centro Local | Seu pedido está próximo | 24 |
| 15 | Saiu para Entrega | Saiu para entrega ao destinatário | 24 |
| 16 | Entregue | Pedido entregue com sucesso | 240 |

#### 2. Migration SQL
- DELETE dos 14 eventos existentes do template `...0005`
- INSERT dos 16 novos eventos com nomes variados e assuntos de email únicos

#### 3. Layout do grid
- Alterar `md:grid-cols-3` para `md:grid-cols-2 xl:grid-cols-4` em `Postagens.tsx`

### Resumo
- 1 migration SQL (substituir eventos, agora 16)
- 1 edit no grid do `Postagens.tsx`

