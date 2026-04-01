

## Plan: Adicionar card de preços no início do Tutorial

### O que será feito

Inserir um card de **"Custos do Serviço"** logo no início da aba Tutorial (antes do card "O que é"), mostrando os preços de forma clara e transparente:

| Canal | Carrinho Abandonado | PIX Pendente |
|-------|---------------------|--------------|
| Email | 0,10 moedas | 0,10 moedas |
| SMS   | 0,15 moedas | 0,15 moedas |

- Ícone `Coins` (lucide-react), estilo glass/glow-border consistente
- Grid 2x2 com os valores em destaque (texto grande, cor primary)
- Nota de rodapé: "Valores podem ser personalizados. Cobrado apenas no envio efetivo."

### Arquivo alterado

- `src/pages/RecuperacaoVendas.tsx` — inserir novo card no `TutorialTab` antes do card "O que é" (~linha 1024)

