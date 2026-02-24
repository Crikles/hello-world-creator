
# Restringir Edicao de Email para Admin

## Resumo

Remover a capacidade de usuarios comuns editarem os templates de email na pagina de Postagens. O botao de editar email (icone de lapis) e o botao de adicionar/excluir eventos serao visiveis apenas para admins. Usuarios comuns verao os eventos do fluxo apenas em modo leitura.

## O que muda

### 1. Pagina Postagens (`src/pages/Postagens.tsx`)

- Importar o hook `useIsAdmin` 
- Chamar `const { isAdmin } = useIsAdmin()` no componente
- **Botao de editar email** (Edit2, linha 528): renderizar apenas se `isAdmin`
- **Botao de excluir evento** (Trash2, linha 531-539): renderizar apenas se `isAdmin`
- **Botao "Adicionar" evento** (Plus, linha 458): renderizar apenas se `isAdmin`
- **Input de delay** (dias apos anterior, linhas 514-525): tornar `disabled` se nao for admin, ou renderizar como texto estático
- **Templates pre-configurados** (cards clicaveis, linha 417-449): remover o `onClick` para usuarios nao-admin, ou desabilitar a interacao

### 2. Nenhum arquivo novo necessario

O hook `useIsAdmin` ja existe e funciona corretamente.

### 3. Nenhuma migracao SQL necessaria

As RLS policies ja impedem que usuarios editem templates de sistema. Os templates clonados pertencem a loja do usuario, entao a restricao e feita no frontend para UX.

## Detalhes Tecnicos

### Alteracoes no `src/pages/Postagens.tsx`

```typescript
import { useIsAdmin } from "@/hooks/useIsAdmin";

// Dentro do componente:
const { isAdmin } = useIsAdmin();
```

Condicionar os elementos interativos:

- `{isAdmin && <Button onClick={() => openEditDialog(evento)}>...}` -- botao editar
- `{isAdmin && !isFirst && <Button onClick={() => deleteEvento.mutate(evento.id)}>...}` -- botao excluir
- `{isAdmin && config?.template_ativo_id && <Button onClick={() => addEvento.mutate()}>...}` -- botao adicionar
- Input de delay: `disabled={!isAdmin}` ou substituir por texto "X dias"
- Cards de template: `onClick={isAdmin ? () => applyTemplate.mutate(template.id) : undefined}` e remover `cursor-pointer` se nao admin
