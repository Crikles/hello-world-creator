

## Adicionar Carrossel de Logos de Parceiros na Seção Benefits (Vetor)

### O que sera feito

Adicionar uma nova seção abaixo dos benefit cards com os logos dos parceiros (Jadlog, Correios e Loggi) em cards brancos com borda arredondada, animados com movimento horizontal infinito (marquee/carousel), responsivo para mobile e desktop.

### Arquivos

**1. Copiar as 3 imagens para o projeto**
- `user-uploads://unnamed_1.jpg` → `public/logo-jadlog.jpg` (cubo vermelho = Jadlog)
- `user-uploads://unnamed.png` → `public/logo-correios.png` (setas amarela/azul = Correios)
- `user-uploads://unnamed.webp` → `public/logo-loggi.webp` (coelho branco = Loggi)

**2. `src/pages/Rastreio.tsx`** - Adicionar seção de parceiros dentro do bloco `!searched && isVetor`

- Nova seção `vt-partners` entre Benefits e Results:
  - Titulo: "Nossos Parceiros" centralizado
  - Container com overflow hidden
  - Faixa duplicada de logos (para loop infinito) animando com translateX
  - Cada logo em card branco, borda arredondada (border-radius 20px), sombra suave, padding generoso
  - Logos com altura fixa (~60px desktop, ~45px mobile), object-fit contain

- CSS novo no `vetorStyles`:
  - `@keyframes vt-scroll` para translateX de 0 a -50% (loop infinito)
  - `.vt-partners-track` com display flex, animacao 15s linear infinite
  - `.vt-partner-card` com fundo branco, border-radius 20px, sombra, padding
  - Hover: pausa a animacao, leve scale
  - Mobile: logos menores, gap reduzido, animacao mais lenta

### Design

```text
Desktop:
┌──────────────────────────────────────────────┐
│           Nossos Parceiros                   │
│                                              │
│  ╭──────╮  ╭──────╮  ╭──────╮  ╭──────╮ ... │
│  │Jadlog│  │Correi│  │Loggi │  │Jadlog│  →  │
│  ╰──────╯  ╰──────╯  ╰──────╯  ╰──────╯     │
│         ← animacao scroll infinito →         │
└──────────────────────────────────────────────┘

Mobile: mesma logica, cards menores
```

Cards: fundo #fff, border 1px solid #f0f0f0, border-radius 20px, box-shadow sutil, padding 24px 32px.

