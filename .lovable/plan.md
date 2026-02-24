
# Integração Vega Checkout - Webhook Backend

## O que será feito

Criar a infraestrutura backend completa para receber webhooks da Vega Checkout, processando dois tipos de eventos:

1. **Venda (sale)** - Pedido pago, pendente, recusado, estornado, etc.
2. **Carrinho Abandonado (abandoned_cart)** - Carrinhos abandonados para recuperação

Os dados recebidos serão normalizados e salvos na tabela `envios`, criando automaticamente novos envios quando uma venda for aprovada.

---

## Estrutura das mudanças

### 1. Nova tabela: `webhook_logs`

Tabela para registrar todos os webhooks recebidos (para debug e auditoria):

- `id` (uuid, PK)
- `checkout_provider` (text) - ex: "vega"
- `event_type` (text) - ex: "sale", "abandoned_cart"
- `status` (text) - status recebido do checkout
- `payload` (jsonb) - payload completo do webhook
- `processed` (boolean) - se já foi processado
- `created_at` (timestamptz)

### 2. Nova tabela: `pedidos`

Tabela dedicada para armazenar pedidos vindos dos checkouts, separada dos envios manuais:

- `id` (uuid, PK)
- `checkout_provider` (text) - "vega", "zedy", etc.
- `transaction_token` (text) - ID unico da transacao no checkout
- `status` (text) - approved, pending, refused, charge_back, refunded, expired, abandoned_cart
- `method` (text) - pix, billet, credit_card
- `total_price` (integer) - valor em centavos
- `customer_name` (text)
- `customer_document` (text)
- `customer_email` (text)
- `customer_phone` (text)
- `address_street` (text)
- `address_number` (text)
- `address_district` (text)
- `address_zip_code` (text)
- `address_city` (text)
- `address_state` (text)
- `address_country` (text)
- `address_complement` (text)
- `products` (jsonb) - array de produtos
- `raw_payload` (jsonb) - payload original completo
- `envio_id` (uuid, FK nullable para envios) - vinculo com envio criado
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 3. Edge Function: `webhook-vega`

Endpoint: `POST /functions/v1/webhook-vega`

A funcao vai:

1. Receber o POST da Vega Checkout
2. Identificar o tipo de evento pelo campo `status`:
   - Se `status` = `abandoned_cart` --> registrar como carrinho abandonado
   - Outros status (`approved`, `pending`, `refused`, etc.) --> registrar como venda
3. Salvar o log completo em `webhook_logs`
4. Normalizar os dados do cliente, endereço e produtos
5. Inserir/atualizar na tabela `pedidos`
6. Se `status` = `approved`, criar automaticamente um registro na tabela `envios` com status "pendente" e vincular ao pedido
7. Retornar HTTP 200

Mapeamento dos campos da Vega para o nosso sistema:

```text
Vega                    -->  pedidos
transaction_token       -->  transaction_token
status                  -->  status
method                  -->  method
total_price             -->  total_price (ja em centavos)
customer.name           -->  customer_name
customer.document       -->  customer_document
customer.email          -->  customer_email
customer.phone          -->  customer_phone
address.*               -->  address_*
products                -->  products (jsonb)

Quando approved:
pedidos                 -->  envios
customer_name           -->  cliente_nome
customer_email          -->  cliente_email
customer_document       -->  cliente_cpf
customer_phone          -->  cliente_telefone
address_*               -->  cliente_endereco, cliente_bairro, etc.
products[0].title       -->  produto
products[0].quantity    -->  quantidade
total_price / 100       -->  valor
```

### 4. Configuracao do config.toml

Adicionar a edge function com `verify_jwt = false` pois webhooks externos nao enviam JWT:

```toml
[functions.webhook-vega]
verify_jwt = false
```

### 5. Atualizacao da pagina de Integracoes (opcional visual)

Nenhuma mudanca visual necessaria agora -- a pagina ja mostra o webhook URL correto. Futuramente podemos mostrar o ultimo webhook recebido e contadores.

---

## Fluxo completo

```text
Vega Checkout --> POST webhook-vega
                    |
                    v
              Salva webhook_logs
                    |
                    v
              Upsert pedidos (by transaction_token + provider)
                    |
                    v
              Se approved? --> Cria envio com status "pendente"
                    |
                    v
              Retorna 200 OK
```

## Detalhes tecnicos

- A edge function usara `SUPABASE_SERVICE_ROLE_KEY` (ja configurado nos secrets) para inserir dados sem precisar de autenticacao do usuario
- O `verify_jwt` sera `false` para permitir que a Vega envie webhooks sem token
- A tabela `pedidos` tera um indice unico em `(checkout_provider, transaction_token)` para evitar duplicatas e permitir atualizacoes de status
- RLS sera desabilitado nas tabelas `webhook_logs` e `pedidos` pois o acesso sera feito apenas via service role key na edge function (nao pelo frontend)
- Para carrinho abandonado (v2.0), usaremos o campo `abandoned_cart_code` como `transaction_token`
