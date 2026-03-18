

## Plano: API Externa para Recebimento de Pedidos

### Contexto
Usuários que não usam checkout (Shopify, Vega, Zedy, etc.) precisam de uma forma de enviar seus pedidos para o sistema. A solução é uma **API pública documentada** que aceita pedidos via POST, autenticada pelo `webhook_token` que cada loja já possui.

### O que será criado

**1. Edge Function `api-external` (novo)**
- Endpoint: `POST /functions/v1/api-external?token=TOKEN_DA_LOJA`
- Aceita um JSON padronizado com dados do pedido (cliente, endereço, produtos, valor)
- Valida o token, resolve a loja, cria o pedido na tabela `pedidos` e o envio na tabela `envios` (mesma lógica dos webhooks existentes)
- Retorna o `pedido_id`, `envio_id` e `codigo_rastreio` na resposta para o usuário integrar no sistema dele

**Payload esperado:**
```json
{
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com",
    "document": "12345678900",
    "phone": "11999999999"
  },
  "address": {
    "street": "Rua Example",
    "number": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipcode": "01001000",
    "complement": "Apto 1"
  },
  "items": [
    { "name": "Produto X", "quantity": 2, "price": 49.90 }
  ],
  "total": 99.80
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "pedido_id": "uuid",
  "envio_id": "uuid",
  "codigo_rastreio": "BR...JL"
}
```

**2. Página de Documentação da API (nova rota no frontend)**
- Nova página `/loja/:lojaId/api-docs` acessível pelo menu lateral
- Mostra o token da loja, a URL do endpoint, o payload esperado com exemplos
- Botão para copiar exemplos em cURL, JavaScript e Python
- Tabela com descrição de cada campo (obrigatório/opcional)

**3. Card na página de Integrações**
- Adicionar um card "API Externa" na página de Integrações com link para a documentação
- Mostra o token e a URL da API

### Detalhes técnicos
- Reutiliza o `webhook_token` já existente em cada loja (sem criar novo token)
- Mesma lógica de criação de pedido/envio dos webhooks existentes (Luna, Zedy, etc.)
- Validação de campos obrigatórios (name, email, items) com mensagens de erro claras
- `checkout_provider` será `"api_externa"` para diferenciar nos logs
- Log no `webhook_logs` para auditoria

