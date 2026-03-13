

## Plano: Seletor de itens por página na listagem de Envios

### O que será feito
Adicionar um seletor de quantidade de linhas por página na área de paginação inferior, com as opções: **20 (padrão), 50, 100, 200, 300, 400, 500, 700, 800**.

### Mudanças em `src/pages/Envios.tsx`

1. **Trocar constante por estado**: Substituir `const ITEMS_PER_PAGE = 20` por um `useState` com valor inicial 20, persistido em `localStorage` para manter a preferência do usuário.

2. **Substituir todas as referências** de `ITEMS_PER_PAGE` por `itemsPerPage` (variável de estado).

3. **Resetar página para 1** quando o usuário mudar o items per page.

4. **Adicionar seletor na barra de paginação**: Um componente `Select` (do shadcn) à esquerda, ao lado do texto "Mostrando X-Y de Z envios", com as opções de quantidade.

Layout da barra de paginação:
```text
[Mostrando 1-50 de 1162 envios] [Select: 50 ▼]          [< 1 2 ... 24 >]
```

