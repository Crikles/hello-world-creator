## Objetivo
Adicionar, na aba **Integrações**, dois novos cards de Widget de Rastreio embutível (`<script>` para colar no Shopify/qualquer site), espelhando o card que já existe para a **ATLAS**:

1. **Widget JETLINE** — apontando para `https://app.jetlinetransportes.com/widget/tracking.js`
2. **Widget GLOBAL** — apontando para `https://us.tracker-master.com/widget/tracking.js` (inglês) ou `https://es.tracker-master.com/widget/tracking.js` (espanhol), com um seletor US/ES dentro do próprio card

## Onde
Arquivo único: `src/pages/Integracoes.tsx` (componente `WidgetRastreioCard`, linhas 339-401).

## Como ficará na UI

```text
┌─ Widget ATLAS ─────────────────────[EMBED]┐  (já existe)
│ <script src="app.atlas-cargo.org/...">    │
└───────────────────────────────────────────┘
┌─ Widget JETLINE ───────────────────[EMBED]┐  (novo)
│ <script src="app.jetlinetransportes.com">  │
└───────────────────────────────────────────┘
┌─ Widget GLOBAL ────────────────────[EMBED]┐  (novo)
│ Idioma: [ Inglês 🇺🇸 ] [ Espanhol 🇪🇸 ]    │
│ <script src="us.tracker-master.com/..."> │
└───────────────────────────────────────────┘
```

Cada card mantém o mesmo layout do atual: título, badge `EMBED`, snippet copiável, botão de copiar e o bloco "Como instalar no Shopify".

## Detalhes técnicos

- Generalizar `WidgetRastreioCard` para receber `marca`, `domain`, `titulo` e `descricao` via props, e renderizar 3 instâncias.
- Para o card Global, manter `useState<'us'|'es'>('us')` interno que troca o domínio do snippet.
- O `data-loja="${lojaId}"` continua o mesmo — a marca é resolvida pelo domínio onde o script é hospedado.
- Sem alterações de backend: cada projeto (TrackMaster e Jetline) já hospeda o próprio `tracking.js` apontando para a API correta.

## Fora do escopo
- Nenhuma alteração em edge functions, banco ou no script `public/widget/tracking.js`.
- Nenhuma mudança no card de API/token existente.