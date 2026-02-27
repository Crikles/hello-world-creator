

# Plano de Implementacao

## 1. Creditos em tempo real na sidebar

Atualmente o saldo de creditos na sidebar usa apenas `useQuery` sem listener de tempo real. Quando moedas sao gastas (ao avancar envios), o saldo so atualiza ao recarregar a pagina.

**Solucao:** Adicionar um listener Supabase Realtime na tabela `creditos` no componente `AppSidebar.tsx`. Quando o saldo mudar, invalidar a query `meu-saldo` para atualizar instantaneamente.

**Arquivo:** `src/components/layout/AppSidebar.tsx`
- Adicionar `useEffect` com `supabase.channel()` escutando `postgres_changes` na tabela `creditos` filtrado por `user_id`
- No callback, chamar `queryClient.invalidateQueries({ queryKey: ["meu-saldo"] })`

**Pre-requisito:** Habilitar realtime na tabela `creditos` via migracao SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.creditos;
```

---

## 2. Dashboard preservar historico apos exclusao de envios

Atualmente a Dashboard busca dados diretamente da tabela `envios`. Se um envio for excluido na aba Envios, ele desaparece da Dashboard tambem (cards de totais, grafico de faturamento, timeline).

**Solucao:** Usar a tabela `creditos_transacoes` (que ja registra cada debito com descricao e timestamp) como fonte de dados para o historico na Dashboard, complementando com os envios existentes. Porem, a abordagem mais simples e eficaz e usar **soft delete** nos envios: em vez de deletar fisicamente, marcar com um campo `deleted_at`.

**Abordagem escolhida: Soft Delete**
- Adicionar coluna `deleted_at timestamptz` (nullable, default null) na tabela `envios`
- Na pagina Envios, o botao de excluir faz `UPDATE SET deleted_at = now()` em vez de `DELETE`
- Na pagina Envios, filtrar apenas `deleted_at IS NULL` para nao mostrar excluidos
- Na Dashboard, buscar TODOS os envios (incluindo "excluidos") para manter totais, faturamento e timeline intactos

**Arquivos:**
- Migracao SQL: adicionar coluna `deleted_at`
- `src/pages/Envios.tsx`: mudar delete para soft delete, filtrar `deleted_at.is.null`
- `src/pages/Dashboard.tsx`: remover filtro (buscar todos, incluindo soft-deleted)

---

## 3. Verificar email de confirmacao de conta

Atualmente **nao existe** nenhum template customizado de email para autenticacao. Nao ha pasta `supabase/functions/auth-email-hook/` nem templates em `_shared/email-templates/`. Isso significa que o sistema esta usando o **email padrao do Lovable Cloud** para confirmacao de conta — um template generico, nao personalizado com a marca do projeto.

**Informacao para o usuario:** Os emails de verificacao de conta estao sendo enviados pelo sistema padrao do Lovable Cloud, sem personalizacao visual. Para customizar com logo, cores e textos da marca, seria necessario configurar um dominio de email personalizado e criar templates customizados.

---

## Resumo de mudancas tecnicas

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | `ALTER PUBLICATION supabase_realtime ADD TABLE creditos` + coluna `deleted_at` em `envios` |
| `src/components/layout/AppSidebar.tsx` | Listener realtime para atualizar saldo |
| `src/pages/Envios.tsx` | Soft delete + filtro `deleted_at.is.null` |
| `src/pages/Dashboard.tsx` | Buscar todos envios (sem filtro de deleted_at) |

