## O que muda

### 1. Lead não precisa mais saber o número do pedido
Hoje o card esquerdo exige **pedido + (e-mail|CPF)**. Vou tornar o número do pedido **opcional**:

- Se o lead digitar **só e-mail** (ou só CPF), o backend busca o envio mais recente daquela loja para aquele contato.
- Se houver vários envios para o mesmo contato, retorna a lista (até 5) e o widget mostra um seletor "Selecione seu pedido" com produto + data + últimos dígitos do código.
- Se digitar pedido + contato, mantém a lógica atual (match exato).

Mudanças:
- `supabase/functions/widget-buscar-pedido/index.ts`: aceitar requisição sem `numero`; nesse caso, consultar `envios` da loja por `cliente_email`/`cliente_cpf` (e fallback em `pedidos.customer_email/customer_document`) ordenado por `created_at desc`, devolvendo `{ matches: [{codigo_rastreio, produto, created_at}] }` quando houver mais de um, ou `{ codigo_rastreio }` direto quando for único.
- Label do campo passa a ser "Número do Pedido (opcional)".

### 2. Resultado bonito (substitui as telas feias dos prints)

Atualmente o resultado mostra:
- Produto em JSON cru (`[{"nome":"KIT...","quantidade":1}]`)
- Status em snake_case (`em_transito`, `pendente`)
- Sem datas em cada etapa
- Sem cidade de origem
- Timeline sem hierarquia (todos os pontos iguais)
- Layout apertado

Vou redesenhar dentro do mesmo Shadow DOM (`public/widget/tracking.js`):

**Header do card**
- Chip de status com label amigável ("Em trânsito", "Pendente", "Entregue", "Saiu para entrega", "Postado", "Coletado") — mapa de status no widget.
- Título = produto formatado via mesma lógica de `src/lib/format-produto.ts` (decodifica JSON, junta nomes, mostra `(xN)` quando quantidade > 1).
- Linha secundária: código do rastreio (monospace) + botão "copiar".
- Transportadora alinhada à direita com ícone de caminhão.

**Bloco de rota (novo)**
Cartão com 3 colunas: **Origem → Em trânsito → Destino**
- Origem: cidade/UF da loja (já vem em `origem.cidade/estado` da `rastreio-info`).
- Meio: barra de progresso com % calculado por `ultimo_evento_ordem / totalEventos`.
- Destino: `cliente_cidade/UF`.
- Linha embaixo: "Destinatário: J*** S***" (já mascarado pelo backend).

**Timeline com datas**
- Eventos em ordem cronológica decrescente (mais recente em cima).
- Cada item: bolinha colorida (cheia = concluído, vazada = futuro), título do evento, descrição, **data formatada** ("11 jun · 14:32").
- A data de cada etapa é calculada como `envio.created_at + delay_horas` (já temos `delay_horas` em `postagem_eventos`, só não estávamos usando). Backend já manda isso — só usar no front.
- Primeiro evento destacado com fundo levemente colorido + label "Atualização mais recente".
- Eventos futuros (que existem no template mas ainda não rolaram) aparecem em cinza claro, opcional — controlado por flag interna. **Por padrão: só os já ocorridos.**

**Rodapé**
- "Última atualização: <data>" pequeno em cinza.
- Botão "Nova consulta" como ghost button.

**Cor primária**
- Já vem em `cor_primaria` da resposta. Quando `data-cor` não for definido no embed, usar a cor da loja automaticamente (hoje cai pro azul fixo).

### 3. Atualizar preview
- `public/widget-preview.html` atualizado pra refletir o novo layout (mock com origem São Paulo/SP → destino Rio de Janeiro/RJ, timeline com datas, status amigável).

## Arquivos tocados
- `supabase/functions/widget-buscar-pedido/index.ts` — busca sem número
- `public/widget/tracking.js` — UI redesenhada + suporte a múltiplos matches + cor da loja por padrão
- `public/widget-preview.html` — mock atualizado

Sem mudanças de schema, sem nova migration.

## Pontos pra confirmar
1. Quando o e-mail tiver vários pedidos, prefere **lista de seleção** (até 5) ou **só o mais recente**?
2. Mostrar os **eventos futuros** em cinza (como um "stepper" completo) ou só os já ocorridos?
