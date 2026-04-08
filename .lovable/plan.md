

## Plano: Bloquear indexação do Google e solicitar remoção

### Situação atual

O `robots.txt` está com `Allow: /` para **todos os bots**, incluindo Googlebot. Isso permite que o Google indexe todas as páginas do site, incluindo a de login que mostra "Magnus Frete".

### O que podemos fazer

**1. Bloquear indexação futura (imediato)**

- **`robots.txt`**: Trocar para `Disallow: /` para Googlebot e demais bots de busca. Manter `Allow` apenas para bots de preview social (Twitter, Facebook) para que links compartilhados continuem mostrando preview.
- **`index.html`**: Adicionar `<meta name="robots" content="noindex, nofollow">` no `<head>` como camada extra de proteção.

**2. Remover páginas já indexadas (manual, fora do código)**

O Google leva semanas para respeitar o `robots.txt` atualizado. Para acelerar a remoção:
- Acesse o [Google Search Console](https://search.google.com/search-console) → cadastre o domínio `magnusfrete.com` → use a ferramenta **"Remoções"** para solicitar remoção temporária da URL. Isso remove em 24-48h.
- A tag `noindex` fará o Google remover permanentemente quando re-rastrear.

### Alterações no código

**`public/robots.txt`**
```
User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /

User-agent: *
Disallow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /
```

**`index.html`** — Adicionar no `<head>`:
```html
<meta name="robots" content="noindex, nofollow">
```

### Resultado esperado
- Nenhum bot de busca indexará novas páginas
- Previews de links no WhatsApp/Twitter/Facebook continuam funcionando
- Páginas já indexadas serão removidas automaticamente em algumas semanas (ou em 24-48h via Google Search Console)

