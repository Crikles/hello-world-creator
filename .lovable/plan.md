
## Objetivo

Transformar a página pública de rastreio (`/r/:codigoParam`) na identidade da **ATLAS CARGO EXPRESS**, substituindo todo o branding da JL Transportes. A Vetor Transportes será desligada (mas o código permanece intacto). A JADLOG continua como está.

## Mudanças

### 1. Lógica de detecção da transportadora (linhas 270–292)
- **Vetor → "off"**: manter o bloco `isVetor` e todo o JSX/CSS da Vetor (linhas 306–741) intactos, mas forçar `isVetor = false` (comentando os checks de hostname/sufixo `VT`/`transportadora`). Nada da Vetor renderiza, mas o código fica preservado para reativar depois.
- **JL → ATLAS**: o bloco "default" (linhas 1018+) deixa de ser "JL Transportes" e passa a ser **ATLAS CARGO EXPRESS**. Renomear variáveis/comentários `theme-jl` → `theme-atlas`, classes `jl-*` → `atlas-*` (apenas no bloco default).
- `empresaNome` default → `"ATLAS Cargo Express"`.
- `logoUrl` default → novo asset da logo ATLAS.
- `primaryColor` default → vermelho ATLAS (`#E10E1A`) substituindo o roxo `#6366f1`.
- `document.title` default → `"ATLAS Cargo Express - Rastreio"`.

### 2. Paleta nova (substitui o roxo)
Baseada na logo enviada (preto + cromado + vermelho):

```
--atlas-red:        #E10E1A   (primário / CTAs / destaques)
--atlas-red-deep:   #8E0911   (hover / sombras)
--atlas-black:      #0A0A0B   (fundos escuros)
--atlas-graphite:   #17181C   (cards / superfícies)
--atlas-silver:     #C9CDD2   (linhas / texto secundário)
--atlas-white:      #F4F5F7   (texto)
```

Aplicar em: header, hero, barra de stats, cards "como funciona", seção "sobre nós", footer, botões, badges, ícones, barra de progresso do rastreio.

### 3. Assets
Subir via `lovable-assets` (no modo build):
- `src/assets/atlas-logo.png` ← `user-uploads://ChatGPT_Image_2_de_jun._de_2026_19_15_50-removebg-preview.png`
- `src/assets/atlas-truck.jpg` ← `user-uploads://ChatGPT_Image_2_06_2026_19_23_57.png`

Substituir as referências antigas:
- `/logojltransportes.png` → import da logo ATLAS
- `/jl-truck.png` (linha 1313) → import do caminhão ATLAS

### 4. Conteúdo textual (bloco default)
- Header: "JL Transportes" → "ATLAS Cargo Express"
- Hero/headlines: trocar menções "JL" por "ATLAS"
- Slogan: **"Sua carga, nosso compromisso."** (vem do próprio caminhão da marca)
- Seção "Sobre nós": "Por que escolher a JL Transportes?" → "Por que escolher a ATLAS Cargo Express?"
- Email de contato `contato@jltransportelogistica.com` → `contato@atlascargoexpressltda.com`
- Stats bar e os 3 passos: mantém estrutura, só ajusta cor e copy onde cita "JL"

### 5. Domínio customizado
O endereço final será `https://rastrear.atlascargoexpressltda.com/r/<codigo>`.

O SPA fallback da Lovable já cuida da rota `/r/:codigo` automaticamente — **não há mudança de código** para isso. Você precisa apenas:

1. **Project Settings → Domains → Connect Domain**
2. Informar `rastrear.atlascargoexpressltda.com`
3. Adicionar no seu registrador um **A record** `rastrear` → `185.158.133.1` e o **TXT** `_lovable` que a Lovable mostrar
4. Aguardar propagação (até 72h, SSL automático)

> Não vou tocar em nada da Vetor (`vetortransportesltda.com`) nem da JADLOG — esses domínios continuam funcionando como hoje.

### 6. Fora de escopo
- Não mexo no painel admin nem em tabelas (`logistica_provider`, `lojas`, etc.). O rebranding é puramente visual no `/r/:codigo`.
- JADLOG permanece inalterada.
- O bloco de código da Vetor fica preservado, só desligado via flag.

## Detalhes técnicos

- Arquivo único afetado: `src/pages/Rastreio.tsx`
- Novos arquivos: `src/assets/atlas-logo.png.asset.json`, `src/assets/atlas-truck.jpg.asset.json` (gerados via `lovable-assets create`)
- Sem mudanças em rotas, banco, edge functions, ou outras páginas
- Sem novas dependências

## Resultado esperado

Ao acessar `/r/<codigo>` (em qualquer domínio que não seja Vetor/Jadlog), o visitante vê a página da **ATLAS Cargo Express**: paleta preto+vermelho+prata, logo nova, foto da frota de caminhões ATLAS, copy reescrita. Vetor segue existindo no código, pronta pra ser religada trocando uma linha.
