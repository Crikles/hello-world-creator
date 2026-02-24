

# Mover Edicao de Email para Admin e Restringir Fluxos

## Resumo

Tres mudancas principais:
1. A edicao de email (EmailEditor) sai da pagina Postagens e vai para o painel Admin, editando os **templates de sistema** (afeta todas as contas)
2. Remover o botao "Adicionar Evento" completamente
3. Usuarios comuns so podem editar os **dias de delay** dos eventos -- nenhum outro controle de edicao de fluxo

## O que muda

### 1. Pagina Postagens (`src/pages/Postagens.tsx`)

- **Remover** o botao "Adicionar" evento (linhas 459-464) -- completamente, nem para admin
- **Remover** o botao de editar email (Edit2, linhas 535-537) -- completamente
- **Remover** o botao de excluir evento (Trash2, linhas 538-547) -- completamente
- **Remover** o componente EmailEditor e todo o estado associado (`editingEvento`, `editDialogOpen`, `openEditDialog`, `handleSaveEvento`)
- **Remover** as mutations `deleteEvento` e `addEvento`
- **Manter** apenas o input de delay (dias) editavel pelo usuario para cada evento (ja funciona)
- O import de `useIsAdmin` pode ser removido ja que nao sera mais usado nesta pagina

### 2. Painel Admin - Nova pagina de Templates (`src/pages/admin/AdminTemplates.tsx`)

Nova pagina no admin que lista os templates de sistema e seus eventos. Ao clicar em editar um evento, abre o EmailEditor existente. As alteracoes sao feitas nos **eventos dos templates de sistema**, afetando todas as contas que usam aquele template.

Funcionalidades:
- Lista os templates de sistema com seus eventos
- Botao de editar email em cada evento (abre EmailEditor)
- Ao salvar, atualiza o `postagem_eventos` do template de sistema

### 3. Rota e Sidebar do Admin

- Nova rota `/admin/templates` no `App.tsx`
- Novo item no menu da sidebar admin (`AdminSidebar.tsx`): "Templates" com icone `FileText`

### 4. RLS - Adicionar policy para admin editar eventos de templates de sistema

Atualmente, os eventos de templates de sistema so tem policy de SELECT para "Anyone can read". Precisamos de uma policy para admin poder UPDATE (editar assunto, corpo, etc) nos eventos de templates de sistema.

## Detalhes Tecnicos

### Arquivos modificados
- `src/pages/Postagens.tsx` -- remover botoes de edicao, EmailEditor, mutations desnecessarias
- `src/components/admin/AdminSidebar.tsx` -- adicionar item "Templates"
- `src/App.tsx` -- adicionar rota `/admin/templates`

### Arquivos novos
- `src/pages/admin/AdminTemplates.tsx` -- pagina de gestao de templates no admin

### Migracao SQL necessaria

Adicionar policy para admin editar eventos de templates de sistema:

```sql
CREATE POLICY "Admins can manage system template eventos"
ON public.postagem_eventos
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### AdminTemplates.tsx - Estrutura

```text
+------------------------------------------+
| Gestao de Templates                      |
| Edite os templates de email do sistema   |
+------------------------------------------+
| Template: Fluxo Padrao                   |
| +--------------------------------------+ |
| | Postado  | Assunto: ...  [Editar]    | |
| | Em Transito | Assunto: ... [Editar]  | |
| | Entregue | Assunto: ...    [Editar]  | |
| +--------------------------------------+ |
|                                          |
| Template: Fluxo Completo                 |
| +--------------------------------------+ |
| | ...                                  | |
| +--------------------------------------+ |
+------------------------------------------+
```

Ao clicar em "Editar", abre o EmailEditor com os dados do evento. Ao salvar, faz UPDATE no evento do template de sistema. Como o template e de sistema (`is_system = true`), a alteracao reflete globalmente.

### Postagens.tsx - O que sobra

O usuario comum vera:
- Configuracoes gerais (toggles de NF, rastreio, etc)
- Templates pre-configurados (cards clicaveis para aplicar)
- Eventos do fluxo ativo em modo leitura, podendo editar apenas os dias de delay
- Custo estimado

