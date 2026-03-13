

## Plano: Reforçar segurança dos endpoints públicos

### Problema identificado
Os endpoints públicos (`rastreio-info`, `falha-info`, `pagamento-info`) expõem dados pessoais (CPF, endereço) sem nenhuma verificação adicional. Qualquer pessoa com um `envio_id` ou código de rastreio pode acessar esses dados.

### Melhorias propostas

**1. Mascarar dados sensíveis nos endpoints públicos**

Nos 3 endpoints, mascarar CPF e endereço parcialmente:
- CPF: `123.456.789-00` → `***.456.7**-**`
- Endereço: mostrar apenas cidade/estado, não o endereço completo
- Remover `cliente_numero`, `cliente_bairro`, `cliente_complemento` do retorno público

**2. Adicionar rate limiting básico** (opcional, mais complexo)

Verificar headers de IP e limitar requisições por minuto via lógica no edge function.

### Arquivos alterados
- `supabase/functions/rastreio-info/index.ts` — mascarar dados no retorno
- `supabase/functions/falha-info/index.ts` — mascarar CPF, reduzir endereço
- `supabase/functions/pagamento-info/index.ts` — mascarar CPF, reduzir endereço

### Impacto
As páginas públicas de rastreio, taxação e falha na entrega continuarão funcionando normalmente, mas exibirão dados parcialmente mascarados, protegendo a privacidade dos clientes.

