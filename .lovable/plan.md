

# Ranking de Recargas no Painel Admin Usuários

## O que será feito

Adicionar uma seção de ranking acima da tabela de usuários mostrando os top recarregadores, baseado apenas em pagamentos PIX confirmados (`pix_payments` com `status = 'CONFIRMED'`), excluindo bônus adicionados pelo admin.

## Mudanças em `src/pages/admin/AdminUsuarios.tsx`

### 1. Nova query para buscar totais de recargas

Buscar todos os `pix_payments` com `status = 'CONFIRMED'`, agrupar por `user_id` somando `moedas`, e cruzar com `profiles` para nome/email.

```typescript
const { data: rankingData = [] } = useQuery({
  queryKey: ["admin-ranking-recargas"],
  queryFn: async () => {
    const { data: payments } = await supabase
      .from("pix_payments")
      .select("user_id, moedas")
      .eq("status", "CONFIRMED");
    
    // Agrupar por user_id
    const totals: Record<string, number> = {};
    (payments || []).forEach(p => {
      totals[p.user_id] = (totals[p.user_id] || 0) + Number(p.moedas);
    });
    
    // Cruzar com profiles
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
    
    return Object.entries(totals)
      .map(([uid, total]) => {
        const prof = (profiles || []).find(p => p.id === uid);
        return { user_id: uid, full_name: prof?.full_name, email: prof?.email, total_recargas: total };
      })
      .sort((a, b) => b.total_recargas - a.total_recargas);
  }
});
```

### 2. Card de ranking com medalhas

Exibir um Card "Ranking de Recargas" com uma tabela compacta mostrando posição (com medalhas dourada/prata/bronze para top 3), nome, email e total recarregado. Ícone `Trophy` do lucide-react.

### 3. Também adicionar `total_recargas` na interface `UserRow`

Para mostrar na tabela principal uma coluna "Recargas" ao lado de "Créditos", usando os dados já calculados no ranking.

### Arquivos alterados
- `src/pages/admin/AdminUsuarios.tsx`

