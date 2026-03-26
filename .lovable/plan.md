

## Plan: Menu de Escolha para Exportação (CSV ou Excel)

### O que muda
O botão "Exportar" vira um **DropdownMenu** com duas opções: **CSV** e **Excel (.xlsx)**. O Excel terá colunas formatadas com cabeçalho em negrito e largura automática.

### Alterações em `src/pages/Envios.tsx`

1. **Instalar `xlsx`** (biblioteca SheetJS) para gerar arquivos Excel no browser — sem dependência de backend

2. **Adicionar função `handleExportXLSX`** que:
   - Cria um workbook com os mesmos dados do CSV (Nome, Email, Telefone, Produto, Valor, Código Rastreio, Link Rastreio, Status, Data)
   - Aplica largura automática nas colunas baseado no conteúdo
   - Faz download como `.xlsx`

3. **Substituir o `<Button>` atual** por um `<DropdownMenu>` com:
   - Trigger: botão "Exportar" com ícone de Download
   - Item 1: "Exportar CSV" → chama `handleExportCSV` existente
   - Item 2: "Exportar Excel" → chama `handleExportXLSX`

### Resultado
Ao clicar em "Exportar", o usuário escolhe o formato. O Excel vem com colunas ajustadas e cabeçalho formatado, ideal para abrir direto sem ajuste manual.

