## Objetivo

Remover toda dependência de `atlas-cargo.org` (raiz) e `www.atlas-cargo.org` para que você possa **excluí-los do painel Lovable** sem quebrar nada. O subdomínio `app.atlas-cargo.org` continua como **único host público de rastreio Atlas**.

## Trocas no código

### 1. `src/lib/domain-config.ts`
Linha 48 — remover hosts raiz/www, manter só `app.atlas-cargo.org`:
```ts
if (host === 'app.atlas-cargo.org') return 'atlas';
if (host.includes('jltransporte')) return 'atlas';
```
Tira também o catch‑all `host.includes('atlas')` (genérico demais) e o comentário sobre `atlas-cargo.org` no topo do arquivo.

### 2. `index.html` (linha 27)
Redirect dos domínios antigos (JL/Vetor) passa a apontar para `app.atlas-cargo.org`:
```js
location.replace('https://app.atlas-cargo.org' + location.pathname + ...);
```

### 3. `supabase/functions/send-email/index.ts` (linha 403)
Default `appBaseUrl` muda para `https://app.atlas-cargo.org`.

### 4. `src/pages/Integracoes.tsx` (linha 342) — script do widget
```html
<script src="https://app.atlas-cargo.org/widget/tracking.js" async></script>
```

### 5. `public/widget/tracking.js` (comentário linha 5)
Atualizar exemplo no comentário do header para `app.atlas-cargo.org`.

### 6. `src/pages/Postagens.tsx` (linha 883)
Provider "atlas" → `site: "https://app.atlas-cargo.org"`.

### 7. Admin placeholders (cosmético)
- `src/pages/admin/AdminSMS.tsx` linha 94 → `https://app.atlas-cargo.org/r/...`
- `src/pages/admin/AdminPush.tsx` linhas 413 e 525 → idem.

### 8. `src/data/tutorials.ts` (linha 371)
Texto do tutorial: substituir "atlas-cargo.org" por "app.atlas-cargo.org".

### 9. E‑mails/contato (sem mudança de domínio, só checagem)
- `contato@atlas-cargo.org` em `TermosPrivacidade.tsx`, `Rastreio.tsx` e `send-push-notification/index.ts` — **manter**. É e‑mail no domínio raiz, independente de o site raiz estar publicado; o MX continua válido mesmo se o domínio for excluído do Lovable, **desde que o DNS no registrar siga existindo**. Se você for excluir o domínio também do registrar, esse e‑mail morre — me avise que eu troco para `contato@magnusfrete.net` ou outro.

## Migração no banco (opcional, recomendado)

Lojas com `logistica_provider='atlas'` que tenham `app_base_url`/links já gravados apontando para `atlas-cargo.org` continuariam expondo o domínio antigo nos e‑mails antigos. Não há schema novo, é só um UPDATE de dados:

```sql
UPDATE postagem_config
SET <campo_que_armazena_link> = REPLACE(<campo>, 'https://atlas-cargo.org', 'https://app.atlas-cargo.org')
WHERE <campo> ILIKE '%atlas-cargo.org%';
```

Como não tenho certeza de quais colunas guardam URL hardcoded, na etapa de build vou listar primeiro com um SELECT, mostro o resultado, e só rodo o UPDATE depois.

## Fora de escopo

- Não mexo nos guardas que tratam JL/Vetor como logística — eles continuam redirecionando para Atlas.
- Não mexo em `magnusfrete.net` (painel) nem em outros providers (`trackmaster_*`, `jetline`, `vetor`).

## O que você faz depois do deploy

1. Confirmar que `https://app.atlas-cargo.org/r/<codigo>` abre o rastreio normalmente.
2. No painel Lovable → **Project Settings → Domains**, remover `atlas-cargo.org` e `www.atlas-cargo.org`.
3. (Opcional) No registrar, apagar os registros A de `@` e `www` se também não for mais usar o raiz — mas mantenha os registros MX se quiser preservar `contato@atlas-cargo.org`.
