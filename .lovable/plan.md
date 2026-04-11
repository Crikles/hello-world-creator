

## Diagnóstico

### Problema 1: Valor errado no painel de Rastreio
O payload da Vega envia `products[].amount: 500` (que é o **preço** em Reais) e `products[].quantity: 1`. Porém, no webhook-vega, linha 48, o código faz:
```
quantity: Number(p.amount || p.quantity || 1)
```
Como `p.amount` (500) é avaliado primeiro e é truthy, a **quantidade** está sendo definida como 500 em vez de 1. Isso faz o envio mostrar "quantidade: 500" e o produto aparecer como "Produto Dois Rifa (x500)".

### Problema 2: Confirmação de Pagamento não chegou
A Edge Function `send-payment-confirmation` está **crashando** com o erro:
```
SyntaxError: Identifier 'mostrarRodape' has already been declared (line 48:9)
```
A variável `mostrarRodape` é declarada na linha 53 e novamente na linha 59. Também há referência a `resolvedCorpo` (linha 59-61) que não existe nesse escopo. Isso foi introduzido na refatoração anterior do template.

---

## Plano de Correção

### 1. Corrigir extração de quantidade no webhook-vega
Na função `extractProducts`, trocar a ordem de prioridade para que `quantity` seja lido antes de `amount`:
```typescript
quantity: Number(p.quantity || 1),  // Remover p.amount daqui
```

### 2. Corrigir variável duplicada no send-payment-confirmation
- Remover a segunda declaração de `mostrarRodape` (linha 59)
- Remover as referências a `resolvedCorpo` (linhas 59-61) e usar `corpo` diretamente para as tags `conf_cor_primaria` e `conf_cor_texto`, que já foram parseadas antes

### 3. Redeployar ambas as Edge Functions

### 4. Corrigir envios existentes com quantidade errada
Atualizar os envios recentes da Vega que têm quantidade 500 para a quantidade correta (1).

---

## Detalhes Técnicos

**Arquivo 1**: `supabase/functions/webhook-vega/index.ts` — linha 48
- De: `quantity: Number(p.amount || p.quantity || 1)`
- Para: `quantity: Number(p.quantity || 1)`

**Arquivo 2**: `supabase/functions/send-payment-confirmation/index.ts` — linhas 53-61
- Remover linhas 59-61 (duplicadas/inválidas)
- As variáveis `corPrimaria` e `corTexto` devem usar `corpo` como parâmetro do `parseConfTag`

