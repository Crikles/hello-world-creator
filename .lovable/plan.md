

## Plano: Remover vazamento de "Magnus Frete" nas páginas públicas

### Diagnóstico

O problema é o `<title>Magnus Frete</title>` no `index.html`. Como as páginas públicas de rastreio (`/r/:code`), pagamento (`/p/:id`), falha na entrega (`/f/:id`) e taxação **nunca definem `document.title`**, o título da aba do navegador mostra "Magnus Frete" para todos os leads. Se o lead pesquisar "Magnus Frete" no Google, encontra o site.

Além disso, as meta tags OG no `index.html` também contêm "Magnus Frete" — visíveis quando alguém compartilha o link.

### Alterações

**1. `index.html` — Título genérico**

Trocar o título e meta tags de "Magnus Frete" para algo neutro como "Rastreio de Encomendas":

- `<title>Rastreio de Encomendas</title>`
- `og:title` → "Rastreio de Encomendas"
- `twitter:title` → "Rastreio de Encomendas"
- Remover `<meta name="author" content="Lovable" />`
- Remover `<meta name="twitter:site" content="@Lovable" />`

**2. `src/pages/Rastreio.tsx` — Definir título dinâmico**

Adicionar `useEffect` que define `document.title` com base na transportadora detectada:
- VETOR → "Vetor Transportes - Rastreio"
- JL → "JL Transportes - Rastreio"
- Fallback → "Rastreio de Encomendas"

**3. `src/pages/FalhaEntrega.tsx` (página pública `/f/:id`)** — Definir título dinâmico:
- "Atualização de Entrega"

**4. `src/pages/Pagamento.tsx` (página pública `/p/:id`)** — Definir título dinâmico:
- "Pagamento - Taxação"

**5. Páginas internas (Dashboard, Login, etc.)** — Definir título como "Magnus Frete" via `useEffect`

Isso garante que páginas internas mantêm "Magnus Frete" no título, mas nenhuma página pública vaza essa informação.

### Resultado esperado
- Nenhum lead verá "Magnus Frete" na aba do navegador ou em previews de links compartilhados
- Páginas internas continuam mostrando "Magnus Frete"
- Meta tags OG limpas de referências ao Magnus e Lovable

