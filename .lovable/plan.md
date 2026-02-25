

# Corrigir Bug: Logo da Navbar Mudando ao Rolar

## Problema

Na linha 150, a variavel `logoUrl` usa `empresa?.logo_url` como primeira opcao:
```typescript
const logoUrl = empresa?.logo_url || "/logojltransportes.png";
```

Quando a pagina carrega e os dados do rastreio retornam, o estado `empresa` e preenchido com os dados da empresa do usuario (incluindo o logo customizado). Isso faz a navbar trocar o logo da JL Transportes pelo logo da empresa cadastrada no painel.

## Solucao

A navbar deve **sempre** exibir o logo fixo da JL Transportes (`/logojltransportes.png`). O logo da empresa do usuario nao deve aparecer na navbar.

### Arquivo: `src/pages/Rastreio.tsx`

**Linha 163** - Trocar `logoUrl` por logo fixo na nav:
```tsx
// De:
<img src={logoUrl} alt={empresaNome} className="nav-logo" />

// Para:
<img src="/logojltransportes.png" alt="Logística JL Transportes" className="nav-logo" />
```

Opcionalmente, as variaveis `logoUrl` e `empresaNome` podem ser mantidas caso sejam usadas em outro lugar da pagina (ex: exibir o logo da loja nos detalhes do envio), mas a navbar ficara com logo fixo.

