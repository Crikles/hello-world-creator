

## Plano: Aprovação em massa na Falha na Entrega

### O que será feito

Adicionar seleção múltipla de cards pendentes com checkbox e um botão "Aprovar Selecionados" que processa todos sequencialmente.

### Alterações em `src/pages/FalhaEntrega.tsx`

**1. Novo estado de seleção**
- `selectedIds: Set<string>` para rastrear os IDs selecionados
- Checkbox "Selecionar todos" na barra de ações (ao lado das tabs), visível apenas na aba "pendentes"
- Limpar seleção ao trocar de aba

**2. Checkbox em cada card pendente**
- Adicionar um `Checkbox` no canto superior esquerdo de cada card pendente
- Toggle do ID no `selectedIds` ao clicar

**3. Botão "Aprovar Selecionados"**
- Aparece na barra de ações quando há itens selecionados
- Mostra quantidade selecionada: "Aprovar (5)"
- Ao clicar, exibe confirmação via toast ou dialog
- Processa sequencialmente chamando `triggerNextEmail` para cada envio selecionado
- Mostra progresso: "Aprovando 3/5..."
- Ao finalizar, limpa seleção e invalida cache

**4. Mutation de aprovação em massa**
```typescript
const bulkApproveMutation = useMutation({
  mutationFn: async (ids: string[]) => {
    const results = [];
    for (const id of ids) {
      const result = await triggerNextEmail(id, loja!.id, true);
      results.push({ id, result });
    }
    return results;
  },
  onSuccess: (results) => {
    const ok = results.filter(r => r.result).length;
    const fail = results.length - ok;
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["falha-envios"] });
    queryClient.invalidateQueries({ queryKey: ["envios"] });
    toast.success(`${ok} pagamento(s) aprovado(s)${fail > 0 ? `, ${fail} falha(s)` : ""}`);
  },
});
```

### Layout da barra de ações (aba pendentes)
```text
[✓ Selecionar todos] [Aprovar (N) ▶]          [🔍 Buscar...]
```

### Resultado esperado
- Usuário pode marcar vários cards e aprovar todos de uma vez
- Feedback visual durante processamento
- Seleção limpa automaticamente após conclusão

