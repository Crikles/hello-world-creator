
# Historico de Pagamentos PIX no Painel Admin

## Objetivo
Adicionar uma nova pagina no painel admin dedicada ao historico de pagamentos PIX, permitindo visualizar todas as transacoes de recarga via PIX, com resumo financeiro e filtros por status.

## O que sera feito

### 1. Nova pagina `AdminPagamentos.tsx`
Criar a pagina `/admin/pagamentos` com:

**Cards de resumo no topo:**
- Total de pagamentos PIX realizados (PAID)
- Valor total em reais movimentado (soma de amount_cents dos PAID, convertido para R$)
- Total de moedas adicionadas via PIX (soma de moedas dos PAID)
- Pagamentos pendentes (PENDING)

**Tabela de transacoes PIX:**
- Data de criacao
- Usuario (nome/email, cruzando com profiles)
- Valor em reais (amount_cents / 100, formatado como R$)
- Moedas creditadas
- Status (PAID, PENDING, CANCELLED) com badges coloridos
- Data do pagamento (paid_at)

**Filtro por status:** Tabs ou select para filtrar entre Todos, Pagos, Pendentes e Cancelados.

### 2. Rota no App.tsx
Adicionar a rota `/admin/pagamentos` apontando para o novo componente.

### 3. Menu no AdminSidebar
Adicionar item "Pagamentos" no menu lateral do admin com icone `CreditCard`.

### Detalhes tecnicos

- A query busca dados da tabela `pix_payments` (acessivel via RLS com role admin -- **necessario adicionar policy de SELECT para admins**) e cruza com `profiles` para exibir nomes
- Reutiliza o padrao existente de `AdminLayout`, `Card`, `Table`, `Badge` e `Tabs`
- Necessaria uma migracao SQL para adicionar policy de leitura admin na tabela `pix_payments`:
  ```sql
  CREATE POLICY "Admins can view all pix_payments"
  ON pix_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
  ```
  Atualmente a tabela so permite leitura pelo proprio usuario e pelo service_role, o admin nao conseguiria consultar.
