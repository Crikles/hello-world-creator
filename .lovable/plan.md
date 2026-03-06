

## Plano: Bônus de 10 moedas a cada 100 recarregadas

### Lógica
`bonus = Math.floor(moedas / 100) * 10` — aplicado tanto nos pacotes quanto no valor personalizado. O PIX é gerado pelo valor base (sem bônus), mas o total de moedas creditadas inclui o bônus.

### Alterações

#### 1. `src/pages/Moedas.tsx`
- Atualizar pacotes: `50, 100, 200, 300` (removendo 500 e 1000)
- Adicionar helper `calcBonus(moedas)` e exibir badge de bônus nos cards dos pacotes (ex: "+10 grátis" no de 100)
- No campo personalizado: ao digitar, mostrar mensagem dinâmica do bônus (ex: "Você ganhará +20 moedas grátis!")
- Enviar `moedas: base + bonus` no body do request para `create-pix-payment`, mantendo `amount_cents` apenas do valor base
- Atualizar textos de confirmação para mostrar total com bônus

#### 2. `supabase/functions/create-pix-payment/index.ts`
- Nenhuma alteração necessária — já recebe `moedas` do frontend e salva no `pix_payments`

#### 3. `supabase/functions/webhook-blackcat/index.ts`
- Nenhuma alteração necessária — já credita `pixPayment.moedas` que já inclui o bônus

### Resultado
- 50 moedas = R$ 50 (sem bônus)
- 100 moedas = R$ 100 + 10 grátis = 110 moedas creditadas
- 200 moedas = R$ 200 + 20 grátis = 220 moedas creditadas
- 300 moedas = R$ 300 + 30 grátis = 330 moedas creditadas
- Personalizado: 150 moedas = R$ 150 + 10 grátis = 160 moedas

### Arquivos alterados
- `src/pages/Moedas.tsx`

