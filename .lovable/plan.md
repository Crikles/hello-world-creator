
# Renomear e Excluir Loja na pagina "Minhas Lojas"

## Resumo

Adicionar um menu de acoes (tres pontinhos) em cada card de loja com as opcoes "Renomear" e "Excluir". Renomear abre um dialog para editar o nome. Excluir abre um AlertDialog de confirmacao antes de remover a loja.

## O que muda

### 1. Menu de acoes no card da loja

Cada card tera um botao com icone `MoreVertical` (ou `Ellipsis`) no canto superior direito. Ao clicar, abre um DropdownMenu com duas opcoes:
- **Renomear** (icone `Pencil`) -- abre dialog para editar o nome
- **Excluir** (icone `Trash2`, texto vermelho) -- abre AlertDialog de confirmacao

O clique no botao de menu nao navega para a loja (stopPropagation).

### 2. Dialog de Renomear

- Input pre-preenchido com o nome atual
- Mutation que faz `UPDATE lojas SET nome = ? WHERE id = ?`
- Invalida query `["lojas"]` ao concluir

### 3. AlertDialog de Excluir

- Mensagem de aviso: "Tem certeza? Todos os dados da loja serao perdidos (envios, pedidos, empresa, etc)."
- Botao de confirmacao em vermelho
- Mutation que faz `DELETE FROM lojas WHERE id = ?`
- O banco ja tem RLS policy "Users can delete own lojas" -- nenhuma migracao necessaria

### 4. Cascata de exclusao (migracao SQL)

Atualmente as tabelas filhas (`envios`, `pedidos`, `empresas`, `webhook_logs`, `postagem_config`, `postagem_email_log`, `postagem_templates`) referenciam `loja_id` mas provavelmente sem `ON DELETE CASCADE`. Precisamos verificar e, se necessario, adicionar cascade para que ao excluir a loja, os dados relacionados sejam removidos automaticamente.

Caso as foreign keys nao tenham cascade, sera necessaria uma migracao para dropar e recriar as constraints com `ON DELETE CASCADE`.

**Nota:** Ao verificar o schema, as tabelas filhas nao possuem foreign keys formais para `loja_id` (a secao foreign-keys esta vazia em todas). Isso significa que a exclusao da loja nao sera bloqueada por constraints, mas os dados orfaos ficarao no banco. Para limpeza, adicionaremos uma database function ou faremos deletes manuais antes de excluir a loja.

## Detalhes Tecnicos

### Arquivo modificado
- `src/pages/Lojas.tsx`

### Novos imports
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` de `@/components/ui/dropdown-menu`
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` de `@/components/ui/alert-dialog`
- Icones: `MoreVertical`, `Pencil`, `Trash2`

### Novos states
- `renameDialog`: `{ open: boolean, lojaId: string, nome: string }`
- `deleteDialog`: `{ open: boolean, lojaId: string, nome: string }`

### Novas mutations

```typescript
// Renomear
const renameMutation = useMutation({
  mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
    const { error } = await supabase
      .from("lojas")
      .update({ nome })
      .eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["lojas"] });
    toast.success("Loja renomeada!");
  },
});

// Excluir (limpa dados relacionados primeiro)
const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    // Deletar dados relacionados (sem FK cascade)
    await supabase.from("postagem_email_log").delete().eq("loja_id", id);
    await supabase.from("postagem_config").delete().eq("loja_id", id);
    await supabase.from("envios").delete().eq("loja_id", id);
    await supabase.from("pedidos").delete().eq("loja_id", id);
    await supabase.from("empresas").delete().eq("loja_id", id);
    await supabase.from("webhook_logs").delete().eq("loja_id", id);
    // Deletar templates e eventos da loja
    const { data: templates } = await supabase
      .from("postagem_templates")
      .select("id")
      .eq("loja_id", id);
    if (templates?.length) {
      const ids = templates.map(t => t.id);
      await supabase.from("postagem_eventos").delete().in("template_id", ids);
      await supabase.from("postagem_templates").delete().eq("loja_id", id);
    }
    // Finalmente deletar a loja
    const { error } = await supabase.from("lojas").delete().eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["lojas"] });
    toast.success("Loja excluida com sucesso!");
  },
});
```

### UI do card (dentro do map)
- Adicionar botao `MoreVertical` com DropdownMenu no canto do card
- `e.stopPropagation()` no trigger para nao navegar ao clicar no menu

### Nenhuma migracao SQL necessaria
As policies de UPDATE e DELETE ja existem para a tabela `lojas`. As tabelas filhas nao tem FK formal, entao a exclusao manual dos dados relacionados resolve.
