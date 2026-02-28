

# Corrigir mapeamento do webhook Shopify para formato nativo

## Problema

O webhook esta recebendo os dados corretamente (status 200), mas o payload da Shopify real tem uma estrutura completamente diferente do formato generico que implementamos. Resultado: campos vazios, status nao detectado, envio nao criado.

## Formato real da Shopify vs formato esperado

```text
Campo                  | Esperado (generico)     | Real (Shopify nativo)
-----------------------|-------------------------|---------------------------
Nome do cliente        | customer.name           | customer.first_name + customer.last_name
Email                  | customer.email          | email (raiz do payload)
Telefone               | customer.phone          | shipping_address.phone
CPF                    | customer.document       | shipping_address.company
Status pagamento       | status                  | financial_status ("paid")
Rua                    | address.street          | shipping_address.address1
Complemento            | address.complement      | shipping_address.address2
Bairro                 | address.district        | shipping_address.address2 (fallback)
CEP                    | address.zip_code        | shipping_address.zip
Cidade                 | address.city            | shipping_address.city
Estado                 | address.state           | shipping_address.province_code
Pais                   | address.country         | shipping_address.country
Produtos               | products[]              | line_items[]
Titulo produto         | products[].title        | line_items[].title
Quantidade             | products[].quantity      | line_items[].quantity
Valor produto          | products[].amount        | line_items[].price (decimal)
Valor total            | total_price (centavos)  | current_total_price (decimal "1.00")
Token transacao        | transaction_token       | id ou name (#1003)
```

## Alteracao

### `supabase/functions/shopify-webhook/index.ts`

Reescrever o mapeamento para suportar o formato nativo da Shopify:

1. **Status**: usar `payload.financial_status` em vez de `payload.status`
2. **Cliente**: concatenar `customer.first_name` + `customer.last_name`
3. **Email**: usar `payload.email` (campo raiz)
4. **Telefone**: usar `shipping_address.phone` ou `customer.default_address.phone`
5. **CPF**: usar `shipping_address.company` (onde a Shopify BR armazena o documento)
6. **Endereco**: usar `shipping_address.address1`, `address2`, `zip`, `city`, `province_code`
7. **Produtos**: iterar sobre `line_items[]` com `title`, `quantity`, `price`
8. **Valor total**: converter `current_total_price` de decimal para centavos (`parseFloat * 100`)
9. **Token**: usar `String(payload.id)` como identificador unico

## Detalhe tecnico do mapeamento

```text
// Status
status = payload.financial_status || ""   // "paid", "pending", etc.

// Cliente
customerName = (customer.first_name + " " + customer.last_name).trim()
customerEmail = payload.email || customer.email
customerPhone = shipping_address.phone || customer.default_address?.phone
customerDocument = shipping_address.company  // CPF no campo company (BR)

// Endereco (shipping_address)
street = shipping_address.address1
complement = shipping_address.address2
city = shipping_address.city
state = shipping_address.province_code
zip = shipping_address.zip
country = shipping_address.country

// Produtos (line_items)
products = line_items.map(item => ({
  code: String(item.product_id || item.sku || ""),
  title: item.title,
  quantity: item.quantity,
  amount: Math.round(parseFloat(item.price) * 100)
}))

// Valor total
totalPrice = Math.round(parseFloat(payload.current_total_price || "0") * 100)

// Token
transactionToken = String(payload.id)
eventType = financial_status === "paid" ? "sale" : financial_status
```

## Resultado

- Pedidos da Shopify serao mapeados corretamente com nome, email, telefone, CPF e endereco
- Status "paid" sera detectado e o envio criado automaticamente
- Valores convertidos de decimal para centavos
- Compativel com o formato real que a Shopify envia via webhook de `orders/paid`
