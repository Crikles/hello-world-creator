

# Correções na Página de Leads Admin

## Problemas Identificados
1. A coluna "Produto" exibe JSON bruto em vez de texto formatado (ex: "Copo Stanley 900ml (x1), Copo Mickey 1000ML (x1)")
2. Não há opção de exportar/baixar os leads
3. Não mostra de qual usuário/loja o lead pertence

## Solução

### 1. Formatar coluna Produto
Reutilizar a lógica `formatProduto` que já existe no projeto (parseia o JSON e exibe como "Nome (xQtd)") diretamente no `AdminLeads.tsx`.

### 2. Adicionar botão "Baixar CSV"
Botão no header que gera e baixa um arquivo CSV com todos os leads filtrados, incluindo colunas: Nome, CPF, Telefone, Email, Produto (formatado), Valor, Endereço completo, Loja.

### 3. Mostrar coluna "Loja/Usuário"
Alterar a query para fazer join com a tabela `lojas` via `loja_id`, trazendo o nome da loja. Adicionar coluna "Loja" na tabela.

## Detalhes Técnicos

### Arquivo modificado: `src/pages/admin/AdminLeads.tsx`

Alterações:
- Adicionar função `formatProduto` (mesma lógica de `Envios.tsx`) para parsear o JSON de produtos
- Alterar query para `supabase.from("leads").select("*, lojas(nome)")` buscando o nome da loja associada
- Adicionar coluna "Loja" na tabela exibindo `lead.lojas?.nome`
- Adicionar botão "Baixar CSV" com ícone `Download` que gera o arquivo CSV client-side com todos os leads filtrados
- A função de export converte os dados para CSV com separador `;` (padrão brasileiro) e encoding UTF-8 BOM para compatibilidade com Excel

### Nenhuma alteração de banco de dados necessária
A tabela `leads` já possui `loja_id` e a tabela `lojas` já existe. O join será feito via query do Supabase.
