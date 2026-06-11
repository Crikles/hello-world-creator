## Objetivo

Permitir que cada lojista cole um snippet de 2 linhas na página de rastreio da loja Shopify dele (ou qualquer site) e os clientes finais consultem o rastreio dos pedidos **daquela loja**, dentro do site do próprio lojista — visual nativo, sem iframe da Atlas.

Modelo igual Reportana:
```html
<div class="atlas-order-tracking" data-loja="LOJA_ID"></div>
<script src="https://atlas-cargo.org/widget/tracking.js" async></script>
```

## Como vai funcionar

1. Lojista entra em **Integrações → Widget de Rastreio**, copia o snippet (já com o `data-loja` preenchido), cola no HTML da página de rastreio do Shopify dele.
2. O `tracking.js` detecta a `<div class="atlas-order-tracking">`, cria um **Shadow DOM** dentro dela (isola CSS — não vaza nem é afetado pelos estilos do Shopify) e renderiza:
   - Tela 1 — formulário com 2 modos lado a lado: **Pedido + e-mail** OU **Código de rastreio**
   - Tela 2 — linha do tempo com os eventos, status atual, transportadora, cidade/estado, produto (mesmos dados do `/rastreio` interno)
3. Tudo busca via endpoint público já existente (`rastreio-info`) + um novo endpoint `widget-buscar-pedido` para o modo "pedido + e-mail".
4. Cores e logo seguem a `postagem_config` da loja (`cor_primaria`, logo da empresa) — fica visualmente alinhado com a marca do lojista.

## O que vai ser construído

### 1. Script público `tracking.js`
- Arquivo servido em `public/widget/tracking.js` (acessível em `https://atlas-cargo.org/widget/tracking.js`).
- Vanilla JS, sem dependências, < 20 KB.
- Cria Shadow DOM, injeta HTML + CSS isolados.
- Lê `data-loja` da div hospedeira.
- Faz chamadas para os endpoints públicos com `loja_id` no query string.
- Auto-altura, responsivo, acessível.

### 2. Endpoint novo: `widget-buscar-pedido` (edge function pública)
- Recebe `loja_id` + `numero_pedido` + `email` (ou só rastreio).
- Valida que o pedido pertence àquela loja (evita um lojista consultar pedidos de outro).
- Retorna o `codigo_rastreio` → o widget chama `rastreio-info` em seguida.

### 3. Ajuste no `rastreio-info`
- Aceitar parâmetro opcional `loja_id` e validar que o código pertence à loja (segurança: lojista A não pode buscar rastreios da loja B colando o widget dele).
- Adicionar header `Access-Control-Allow-Origin: *` (já tem) e permitir uso cross-origin.

### 4. Página nova: `/integracoes/widget-rastreio`
- Mostra o snippet pronto para copiar (com o `loja_id` já preenchido).
- Preview ao vivo do widget renderizado.
- Instruções passo a passo para Shopify (onde colar: Online Store → Pages → criar página "Rastreio" → editar HTML).
- Toggle "Ativar widget" salvo em `postagem_config` (campo novo `widget_rastreio_ativo`).

### 5. Migração
- Adicionar coluna `widget_rastreio_ativo boolean default true` em `postagem_config`.
- Opcional: tabela `widget_uso_log` para contar quantas buscas o widget de cada loja recebe (telemetria).

## Detalhes técnicos

```text
Shopify page (lojista)
└── <div class="atlas-order-tracking" data-loja="UUID">
    └── #shadow-root (isolado)
        ├── <style> ...css próprio... </style>
        └── <div class="widget">
            ├── view: formulário (pedido+email | rastreio)
            └── view: timeline (após busca)
                       │
                       ▼
          GET https://atlas-cargo.org/functions/v1/widget-buscar-pedido
              ?loja_id=...&numero=...&email=...
          GET https://atlas-cargo.org/functions/v1/rastreio-info
              ?codigo=...&loja_id=...
```

**Segurança:**
- Endpoints públicos validam `loja_id` ↔ `codigo_rastreio` / `pedido` (não vaza dados entre lojas).
- E-mail do cliente nunca é retornado, só usado para validar (igual fluxo do Vercaro da imagem).
- Nome do cliente continua mascarado (mesma lógica do `maskName` atual).

**Compatível com Shopify:** Shopify permite `<script>` em páginas (Online Store → Pages → Edit code), não precisa de app instalado.

## Fora de escopo (podemos fazer depois)
- App oficial Shopify publicado na app store.
- Webhooks para puxar pedidos automaticamente do Shopify do lojista (hoje já temos integração separada).
- Customização visual avançada via atributos `data-*` (cor, fonte) — começamos só herdando da `postagem_config`.
