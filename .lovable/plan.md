

# Adicionar coluna "Data" na pagina de Leads

## O que sera feito
Adicionar uma coluna "Data" na tabela de leads mostrando a data/hora em que cada lead foi registrado no sistema, usando o campo `created_at` que ja existe na tabela.

## Detalhes Tecnicos

### Arquivo modificado: `src/pages/admin/AdminLeads.tsx`

- Adicionar coluna "Data" no `TableHeader` (apos "Usuario")
- Exibir `created_at` formatado como data brasileira (ex: "27/02/2026 16:30") no `TableBody`
- Incluir a coluna "Data" tambem na exportacao CSV
- Usar `date-fns` (ja instalado) com `format` e locale `pt-BR` para formatacao

Nenhuma alteracao de banco de dados necessaria -- o campo `created_at` ja existe na tabela `leads`.

