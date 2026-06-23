Adicionar uma tag **GLOBAL** ou **NACIONAL** em cada linha da tabela "Atividade ao Vivo" do Live View, na coluna Cliente (logo abaixo ou ao lado do nome).

## Como determinar

Para cada visitante novo, ao buscar dados do envio em `useLiveVisitorsRealtime`, vou ler também o campo `is_international` da tabela `envios` (já existe). Regra:
- `is_international = true` → tag **GLOBAL** (azul)
- caso contrário → tag **NACIONAL** (verde)

## Mudanças

1. **`src/hooks/useLiveVisitorsRealtime.ts`**
   - Adicionar `scope: "global" | "nacional"` ao tipo `RecentActivity`.
   - No SELECT de `envios`, incluir `is_international`.
   - Popular `scope` para cada novo visitante.

2. **`src/components/live-view/LiveActivityTable.tsx`**
   - Renderizar um pequeno badge ao lado do nome do cliente, tanto no desktop quanto no mobile:
     - GLOBAL: fundo `bg-blue-500/15`, borda `border-blue-500/40`, texto `text-blue-300`.
     - NACIONAL: fundo `bg-emerald-500/15`, borda `border-emerald-500/40`, texto `text-emerald-300`.

Nada mais é alterado (contadores, globo, controles permanecem iguais).
