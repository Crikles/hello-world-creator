
## Plano: corrigir valor da Vega e fazer PIX aparecer no email

### O que encontrei
- O problema está antes do envio do email: no lead mais recente do email `vdklanca@gmail.com`, o sistema salvou:
  - `total_value = 500` em vez de `5`
  - `products[0].value = 0`
  - `checkout_url` vazio
  - `pix_code` vazio
- Porém, no `raw_payload` desse mesmo lead a Vega enviou corretamente:
  - `status = pending`
  - `method = pix`
  - `total_price = 500`
  - `order_url` preenchido
  - `pix_code` preenchido
  - `pix_code_image64` preenchido
- Ou seja: o email não está “inventando” o erro. Ele só está renderizando o que foi salvo errado no `recovery_leads`.
- O `send-recovery-email` já tem a estrutura para mostrar:
  - valor
  - QR Code
  - Copia e Cola
  - botão CTA  
  Mas isso só aparece se o lead vier preenchido corretamente.
- Há ainda um risco adicional: hoje o QR está sendo tratado como `data:image/png;base64,...`; muitos clientes de email não exibem bem esse formato. O ideal é salvar esse QR como imagem pública e usar URL no `<img>`.

### Implementação
1. **Reforçar a normalização no `webhook-vega`**
   - Criar helpers explícitos para:
     - converter valores em centavos para reais
     - ler produtos da Vega V1/V2 com fallback seguro
     - resolver `checkout_url` a partir de `order_url`, `checkout_url`, `abandoned_checkout_url_url` e similares
     - extrair `pix_code`
     - extrair e tratar `pix_code_image64`
   - Garantir que o lead seja salvo assim:
     - `total_value: 5`
     - `products[].value: 5`
     - `checkout_url` preenchido
     - `pix_code` preenchido

2. **Corrigir o QR Code para uso em email**
   - Quando a Vega mandar `pix_code_image64`, converter isso para arquivo de imagem em storage do backend
   - Salvar no lead a **URL pública da imagem**, não o base64 cru
   - Isso aumenta muito a chance do QR aparecer corretamente no email real

3. **Ajustar a lógica do `send-recovery-email`**
   - Manter o valor vindo do lead já normalizado
   - Mostrar o bloco PIX quando houver qualquer combinação útil de dados:
     - QR
     - Copia e Cola
     - link do checkout
   - Garantir que o botão apareça para `pix_pendente` sempre que houver `checkout_url`

4. **Redeploy obrigatório**
   - Publicar novamente:
     - `webhook-vega`
     - `send-recovery-email`
   - O comportamento atual em produção ainda não corresponde ao que o fluxo precisa salvar

5. **Validação após o ajuste**
   - Gerar um novo PIX na Vega e confirmar no lead recém-criado:
     - `total_value = 5`
     - `products[0].value = 5`
     - `pix_code` preenchido
     - `pix_qrcode_url` com URL válida
     - `checkout_url` preenchido
   - Confirmar no email enviado:
     - valor R$ 5,00
     - QR Code visível
     - Copia e Cola visível
     - botão para pagar funcionando

### Observação importante
- Os leads antigos que já foram salvos com valor/PIX errados não serão corrigidos automaticamente.
- Após a implementação, os **novos** PIX gerados deverão sair corretos.
- Se necessário, depois posso preparar uma correção separada para reenviar o último lead de teste já com os dados certos.

### Arquivos envolvidos
- `supabase/functions/webhook-vega/index.ts`
- `supabase/functions/send-recovery-email/index.ts`

### Resultado esperado
O próximo PIX gerado pela Vega deverá criar um lead correto e o email deverá sair com:
- valor certo: **R$ 5,00**
- **QR Code**
- **Código Copia e Cola**
- **botão de pagamento**
