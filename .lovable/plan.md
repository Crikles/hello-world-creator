

## Plano: Redirecionador de Links para Emails

### Problema
Quando o domínio de rastreio cai, todos os links nos emails já enviados ficam inacessíveis. O cliente perde acesso ao rastreio.

### Solução
Criar uma edge function de redirecionamento que funciona como encurtador. Os emails passam a usar o link da edge function (domínio Supabase, que nunca cai). A edge function lê o destino atual de uma config no banco e redireciona. Se o domínio mudar, basta atualizar 1 campo no banco.

### Como funciona

```text
Email → supabase.co/functions/v1/redirect?c=BR1234ABCDEF
                        ↓
          Lê system_config "tracking_base_url"
                        ↓
          302 Redirect → rastreio.jltransportelogistica.com/r/BR1234ABCDEF
```

Se o domínio cair, o admin muda `tracking_base_url` no painel e todos os links antigos passam a apontar para o novo domínio automaticamente.

### Alterações técnicas

**1. Nova entrada em `system_config`**
- Chave: `tracking_base_url`, valor: `https://rastreio.jltransportelogistica.com`
- Editável pelo admin no painel de configurações

**2. Nova Edge Function: `redirect/index.ts`**
- Recebe query param `c` (código de rastreio) e opcionalmente `p` (para links de pagamento com envio_id)
- Busca `tracking_base_url` no `system_config`
- Retorna HTTP 302 redirect para `{tracking_base_url}/r/{codigo}` (ou `/p/{id}` para pagamentos)
- Sem autenticação necessária (verify_jwt = false)

**3. Atualizar `send-email/index.ts`**
- Substituir todos os `${appBaseUrl}/r/${codigoRastreio}` por `${supabaseUrl}/functions/v1/redirect?c=${codigoRastreio}`
- Substituir links de pagamento `/p/${envioId}` por `${supabaseUrl}/functions/v1/redirect?p=${envioId}`

**4. Atualizar outros pontos que geram links**
- `advance-shipments/index.ts` (WhatsApp)
- `send-sms/index.ts` (SMS)
- `emailTemplates.ts` (templates padrão do editor)

**5. Adicionar campo editável no painel admin**
- Em `AdminValores.tsx` ou seção de config do sistema, campo para editar `tracking_base_url`
- O admin pode trocar o domínio a qualquer momento

### Resultado
- Links nos emails nunca quebram (domínio Supabase é permanente)
- Se o domínio de rastreio cair, basta mudar 1 campo no admin
- Todos os emails antigos e novos continuam funcionando

