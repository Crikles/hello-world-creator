

## Plano: Corrigir seletor de quantidade por página

### Problemas identificados

1. **Select dropdown cortado**: O seletor fica na parte inferior da página. Quando abre, o dropdown tenta abrir para baixo e fica cortado pelo viewport. Solução: forçar abertura para cima (`side="top"`).

2. **Largura insuficiente**: O trigger tem apenas `w-[70px]`, apertado para valores de 3 dígitos.

### Mudanças em `src/pages/Envios.tsx`

- Adicionar `side="top"` no `SelectContent` para o dropdown abrir para cima (já que está no rodapé da página)
- Aumentar largura do `SelectTrigger` para `w-[80px]`
- Adicionar texto "por página" ao lado do seletor para clareza

