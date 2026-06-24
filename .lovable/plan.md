## Objetivo
Atualizar o link do site da JetLine exibido na aba Postagem, dentro da seção Logística, para o domínio correto.

## Alteração
- **Arquivo:** `src/pages/Postagens.tsx`
- **Linha 884:** Alterar o campo `site` do provedor `jetline` de `https://jetline-log.com` para `https://app.jetlinetransportes.com`.

## Resultado esperado
Ao selecionar JetLine Logística na aba Postagem, o link exibido apontará para `https://app.jetlinetransportes.com`, consistente com o domínio de rastreio já configurado em `src/lib/tracking-url.ts`.