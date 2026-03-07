

# Organizar Menu da Sidebar em Seções

## Agrupamento proposto

| Seção | Itens |
|-------|-------|
| **Principal** | Dashboard |
| **Operações** | Envios, Postagens, Taxação, Falha na Entrega |
| **Financeiro** | Moedas, Indicação |
| **Negócio** | Empresa, Integrações, WhatsApp |
| **Sistema** | Configurações, Suporte |

## Implementação

### Arquivo: `src/components/layout/AppSidebar.tsx`

Substituir o único `SidebarGroup` com todos os itens por múltiplos `SidebarGroup`, cada um com seu próprio `SidebarGroupLabel` e subset de itens. Estrutura dos dados muda de um array flat para um array de seções:

```typescript
const menuSections = [
  { label: "Principal", items: [{ title: "Dashboard", ... }] },
  { label: "Operações", items: [envios, postagens, taxação, falha] },
  { label: "Financeiro", items: [moedas, indicação] },
  { label: "Negócio", items: [empresa, integrações, whatsapp] },
  { label: "Sistema", items: [configurações, suporte] },
];
```

Cada seção renderiza um `SidebarGroup` separado com o mesmo estilo de label já existente. Nenhum outro arquivo é alterado.

