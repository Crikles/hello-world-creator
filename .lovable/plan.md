

## Plano: Adicionar PIX Copia e Cola, QR Code e botão de pagamento nos emails de recuperação

### Contexto

A Vega (V1 e V2) retorna campos de PIX no payload:
- `pix_code` — código Copia e Cola
- `pix_code_image64` — imagem QR Code em base64
- `checkout_url` / `order_url` — link para página do PIX

Atualmente o webhook-vega **não salva** esses dados no `recovery_leads`, e o email de recuperação **não exibe** seção de PIX.

### Alterações

**1. Migração: adicionar colunas na tabela `recovery_leads`**

```sql
ALTER TABLE public.recovery_leads
  ADD COLUMN pix_code text DEFAULT '',
  ADD COLUMN pix_qrcode_url text DEFAULT '';
```

- `pix_code`: armazena o código Copia e Cola
- `pix_qrcode_url`: armazena a URL da imagem do QR Code (base64 ou URL externa)

**2. `supabase/functions/webhook-vega/index.ts`**

Na hora de inserir o `recovery_leads`, adicionar:
- `pix_code: payload.pix_code || ""`
- `pix_qrcode_url: payload.pix_code_image64 || ""`

**3. `supabase/functions/send-recovery-email/index.ts`**

- Ler `lead.pix_code` e `lead.pix_qrcode_url` do lead
- Quando `tipo === "pix_pendente"` e existir `pix_code`, adicionar ao email:
  - Seção com QR Code (imagem inline via base64 ou URL)
  - Seção "Copia e Cola" com o código PIX em destaque (fundo cinza, fonte mono, visual de campo copiável)
  - Botão CTA "Pagar meu PIX" apontando para `checkout_url` ou `order_url`
- Ajustar a saudação padrão para PIX: "Seu PIX foi gerado mas ainda não identificamos o pagamento"

**4. Outros webhooks (Corvex, Luna, etc.)**

Verificar se também retornam `pix_code` — se sim, salvar da mesma forma. Isso será feito como melhoria futura; o foco agora é Vega.

### Resultado esperado

O email de PIX pendente da Vega incluirá:
1. Imagem do QR Code
2. Código Copia e Cola em destaque
3. Botão para acessar a página de pagamento

