

## Plano: Atualizar Tutorial da Recuperação de Vendas

### O que mudar

**1. Corrigir o passo "Lead é capturado" (linha 1161)**
- Remover a frase "Deduplicação de 24h evita duplicatas" — essa lógica foi removida. Substituir por algo como: "O sistema recebe o webhook, normaliza os dados e salva o lead com status 'pendente'."

**2. Expandir a tabela de checkouts compatíveis (linhas 1137-1144)**
- Adicionar colunas: **QR Code**, **Copia e Cola**, **URL Checkout**
- Dados por checkout:

```text
Checkout   | Carrinho | PIX | QR Code | Copia e Cola | URL Checkout
-----------|----------|-----|---------|--------------|-------------
Vega       |    ✓     |  ✓  |    ✓    |      ✓       |      ✓
Zedy       |    ✓     |  ✓  |    ✗    |      ✗       |      ✓
Luna       |    ✓     |  ✓  |    ✗    |      ✗       |      ✓
Corvex     |    ✓     |  ✓  |    ✗    |      ✗       |      ✓
Adoorei    |    ✓     |  ✓  |    ✗    |      ✗       |      ✓
Shopify    |    ✗     |  ✓  |    ✗    |      ✗       |      ✓
```

- Adicionar nota explicativa abaixo da tabela: "Checkouts que não enviam QR Code e Copia e Cola mostrarão apenas o botão de pagamento no e-mail."

**3. Arquivo alterado**
- `src/pages/RecuperacaoVendas.tsx` — apenas a função `TutorialTab`

### Alterações técnicas
- Atualizar o array `checkouts` para incluir os campos `qrcode`, `copiaECola` e `urlCheckout`
- Atualizar o `<table>` para renderizar as novas colunas
- Editar o texto do step 2 (index 1) no array `steps`

