

## Plan: Corrigir template "Nacional Falha na Entrega" mostrando 0 eventos

### Problema
A query de eventos do sistema em `src/pages/Postagens.tsx` ainda referencia o ID antigo do template Expressa (`000...0003`) que foi deletado, em vez do novo template Falha na Entrega (`000...0004`). Por isso os 9 eventos não são carregados e o card mostra "0 eventos".

### Alteração

**`src/pages/Postagens.tsx` (linha 183)**
- Trocar `"00000000-0000-0000-0000-000000000003"` por `"00000000-0000-0000-0000-000000000004"`

Isso faz com que os 9 eventos do template "Nacional Falha na Entrega" sejam carregados e exibidos corretamente no card, permitindo aplicar o template e ver os badges de status (Postado, Coletado, Em Trânsito, Centro Local, Saiu para Entrega, Falha Entrega, Reenvio Pago, Reenvio Saiu, Entregue).

### O que não muda
- Lógica de aplicação do template (já funciona genericamente)
- Templates Padrão e Taxação
- Backend / banco de dados

