

## Plano: Adicionar Nuvorafy na tabela de checkouts da Recuperação de Vendas

### Análise

A documentação da Nuvorafy fornece **apenas o evento `order.paid`**. Não há evento de pedido pendente, PIX aguardando pagamento, ou carrinho abandonado. O payload também não inclui QR Code, Copia e Cola, nem URL de checkout.

Portanto, a Nuvorafy **não suporta recuperação de vendas** e será adicionada à tabela com todos os campos como `false` (igual Zedy e Adoorei).

### Alteração em `src/pages/RecuperacaoVendas.tsx`

Adicionar uma linha ao array `checkouts` (linha 1143):

```typescript
{ name: "Nuvorafy", qrcode: false, copiaECola: false, urlCheckout: false },
```

### Resultado esperado
- Nuvorafy aparece na tabela "Checkouts com integração nativa" com traços (—) em todas as colunas, indicando que não fornece dados de PIX para recuperação

