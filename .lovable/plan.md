

## Plano: Corrigir webhook-vega (função quebrada desde ~2 de abril)

### Problema
A edge function `webhook-vega` está **completamente fora do ar** com erro de boot:
```
Uncaught SyntaxError: Identifier 'isAbandonedCart' has already been declared
```

A variável `isAbandonedCart` é declarada com `const` na **linha 70** e novamente na **linha 162**. Isso impede que a função inicie, resultando em 500 para todo webhook recebido da Vega.

**Impacto direto**: o usuário `suportevendashojes@gmail.com` (loja "Shopee", token `8e661a8711c3`) não recebe nenhum pedido novo desde 2 de abril. Os últimos pedidos são de 1 de abril.

### Correção

**Arquivo**: `supabase/functions/webhook-vega/index.ts`

1. **Remover a segunda declaração** na linha 162: trocar `const isAbandonedCart = status === "abandoned_cart";` por reutilizar a variável já declarada na linha 70
2. A linha 163 (`const isPendingPix`) está correta e pode permanecer
3. Deploy da função corrigida

### Detalhes técnicos
```text
Linha 70:  const isAbandonedCart = status === "abandoned_cart";   // ← primeira (OK)
Linha 162: const isAbandonedCart = status === "abandoned_cart";   // ← DUPLICADA (REMOVER)
```

A correção é simplesmente remover a linha 162, já que a variável `isAbandonedCart` da linha 70 ainda está no mesmo escopo e tem o mesmo valor.

### Validação
- Deploy e confirmar que a função boota sem erro
- Verificar nos logs que novos webhooks da Vega passam a ser processados
- Confirmar que pedidos e envios voltam a aparecer no painel do usuário

