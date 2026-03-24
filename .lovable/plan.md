

## Criar Logistica "Vetor Transportes" com design proprio

### Resumo

Adicionar a Vetor Transportes como terceira opcao de logistica no sistema, com identidade visual propria (verde escuro, verde claro, grafite), site de rastreio dedicado e preparacao para dominio customizado.

### Arquivos a criar/modificar

**1. Copiar logo para o projeto**
- Copiar `user-uploads://unnamed-removebg-preview_1.png` para `public/logovetor.png`

**2. `src/lib/domain-config.ts`** - Adicionar dominio Vetor
```typescript
const LOGISTICS_DOMAINS = [
  'rastreio.jltransportelogistica.com',
  'rastreio.vetortransportes.com.br'  // placeholder ate definir dominio real
];

export function getLogisticsProvider(): string | null {
  const host = window.location.hostname;
  if (host === 'rastreio.vetortransportes.com.br') return 'vetor';
  if (LOGISTICS_DOMAINS.includes(host)) return 'jl'; // default
  return null;
}
```

**3. `src/App.tsx`** - Atualizar titulo dinamico por provider e passar provider para LogisticsRoutes

**4. `src/pages/Rastreio.tsx`** - Adicionar bloco `isVetor` com design completo:
- Paleta: Verde Escuro `#1B5E20`, Verde Claro `#4CAF50`, Grafite `#37474F`
- Hero com gradiente verde escuro → grafite, linhas de rota/GPS como decoracao
- Nav com logo Vetor, links Inicio/Rastrear/Contato
- Benefits section: "Rastreamento Preciso", "Cobertura Regional", "Parceiro Oficial"
- Timeline com dots verde e header grafite
- Footer com contato Vetor
- Mobile responsivo completo
- CSS inline (`vetorStyles`) seguindo o mesmo padrao de `jadlogStyles`

**5. `src/pages/Pagamento.tsx`** e `src/pages/PagamentoFalha.tsx`** - Detectar transportadora "Vetor" e aplicar cores verdes

**6. `src/pages/Postagens.tsx` (LogisticaTab)** - Adicionar terceiro botao "Vetor Transportes" com logo
- Mutation aceitar `"vetor"` alem de `"jl" | "jadlog"`

**7. `supabase/functions/redirect/index.ts`** - Preparar para redirecionar baseado no provider do envio

### Detalhes do Design Vetor

```text
Nav:     Fundo branco, links grafite, hover verde escuro
Hero:    Gradiente 135deg #1B5E20 → #263238 (grafite escuro)
         Decoracao: linhas diagonais estilo rota/vetor
         Badge: "Logistica estrategica"
         Titulo: "Rastreie sua encomenda com precisao"
         Subtitulo: Parceira oficial Jadlog, Correios e Loggi
Search:  Input branco, botao verde escuro #1B5E20, hover #145218
Benefits: Cards com icones verde, borda hover verde suave
Results: Sidebar com card grafite #37474F (escuro), progress bar verde
Timeline: Header verde escuro, dots verde, linha verde claro
Footer:  Fundo branco, links grafite, hover verde
```

### Detecao de Transportadora

A logica de detecao seguira o padrao existente:
- Campo `transportadora` do envio contendo "VETOR"
- Sufixo do codigo de rastreio "VT" como fallback
- `logistica_provider === "vetor"` na config da loja

### Notas
- Nenhuma migracao de banco necessaria (campo `logistica_provider` ja e texto livre)
- O dominio sera configurado posteriormente pelo usuario
- Todas as paginas publicas (/r, /p, /f) respeitarao o branding Vetor

