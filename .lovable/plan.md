

# Templates de Notificação Push

## Resumo
Adicionar funcionalidade de salvar templates reutilizáveis de notificação push no painel admin, permitindo criar, selecionar e enviar notificações a partir de modelos pré-salvos.

## Nota sobre ícones por plataforma
- **iOS**: O ícone da notificação é sempre o ícone do PWA (manifest.json). Não é possível customizar por notificação -- limitação da Apple.
- **Android**: O campo `icon` do payload funciona normalmente. Cada notificação pode ter um ícone diferente.

## Alterações

### 1. Criar tabela `push_templates` (migração SQL)
```text
- id: uuid (PK)
- nome: text (nome do template, ex: "Pedido atualizado")
- titulo: text (título da notificação)
- mensagem: text (corpo da notificação)
- url: text (link de direcionamento, opcional)
- icon_url: text (ícone personalizado, opcional)
- created_at: timestamptz
```
RLS: Admins full access (apenas admins usam o painel push).

### 2. Atualizar `src/pages/admin/AdminPush.tsx`

**Novas funcionalidades no card "Enviar Notificação":**

- **Botão "Salvar Template"**: Ao lado do botão "Enviar", adicionar um botão secundário que salva o conteúdo atual (título, mensagem, URL, ícone) como um template reutilizável. Pede o nome do template via prompt/input.

- **Seletor de Templates**: Acima dos campos do formulário, adicionar um dropdown/select que lista os templates salvos. Ao selecionar um template, os campos são preenchidos automaticamente.

- **Botão de excluir template**: Ao lado do seletor, um botão para remover o template selecionado.

**Fluxo do usuário:**
1. Preenche título, mensagem, URL e ícone
2. Clica "Salvar Template" e dá um nome (ex: "Pedido taxado")
3. Na próxima vez, seleciona o template no dropdown, campos são preenchidos
4. Pode editar os campos antes de enviar
5. Clica "Enviar" normalmente

### Detalhes técnicos

**Query para templates:**
```text
useQuery("push-templates") -> supabase.from("push_templates").select("*").order("created_at")
```

**Mutation salvar template:**
```text
supabase.from("push_templates").insert({ nome, titulo, mensagem, url, icon_url })
```

**Mutation excluir template:**
```text
supabase.from("push_templates").delete().eq("id", templateId)
```

**UI do seletor:**
- Select com placeholder "Selecionar template..."
- Opção vazia para limpar seleção
- Ao selecionar: setPushTitle, setPushBody, setPushUrl, setPushIcon com valores do template

**Botões no card:**
- Layout: dois botões lado a lado no final do card
  - "Salvar Template" (variante outline, ícone Save)
  - "Enviar para X inscritos" (variante default, ícone Send) -- mantém como está

