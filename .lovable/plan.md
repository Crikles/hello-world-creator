
Objetivo: fazer o email de recuperação de PIX realmente sair com valor correto, QR Code, Copia e Cola e botão CTA.

Diagnóstico confirmado
- O problema principal está nos dados salvos no lead, não no layout do email.
- Nos leads mais recentes da loja `9e2a3528-640c-4839-b886-b55502b4df0b`, os campos persistidos estão vindo errados/vazios:
  - `total_value = 500` em vez de `5`
  - `checkout_url = ''`
  - `pix_code = ''`
  - `pix_qrcode_url = ''`
- Mas o `raw_payload` desses mesmos leads já contém os dados corretos da Vega:
  - `status = pending`
  - `method = pix`
  - `order_url` preenchido
  - `pix_code` preenchido
  - `pix_code_image64` preenchido
- O `send-recovery-email` atual só renderiza:
  - bloco PIX se `lead.pix_code` existir
  - botão CTA se `lead.checkout_url` existir
- Portanto, mesmo “configurado para enviar”, o email sai sem esses elementos porque o lead foi salvo incompleto.
- Os logs mostram o email sendo enviado com sucesso, mas não mostram o log novo de recuperação da Vega, o que reforça que o fluxo ativo em produção não está refletindo corretamente a lógica esperada no webhook.

Plano de implementação
1. Fortalecer o `send-recovery-email` para auto-reparar leads da Vega
- Antes de montar o HTML, reconstruir os dados a partir de `raw_payload` quando os campos persistidos estiverem vazios ou incorretos:
  - `checkout_url` via `order_url`, `checkout_url`, `abandoned_checkout_url_url`
  - `pix_code` via `raw_payload.pix_code`
  - `total_value` via conversão de `raw_payload.total_price` de centavos para reais
- Se existir `pix_code_image64` e `pix_qrcode_url` estiver vazio:
  - converter o base64 em imagem
  - subir no bucket público `pix-qrcodes`
  - usar a URL pública no email
- Opcionalmente atualizar o próprio `recovery_leads` com os valores corrigidos para reaproveitar em reenvios.

2. Manter o `webhook-vega` como fonte correta para novos leads
- Reforçar a normalização no webhook para garantir que novos leads já sejam gravados corretamente:
  - `total_value` em reais
  - `products[].value` em reais
  - `checkout_url` preenchido
  - `pix_code` preenchido
  - `pix_qrcode_url` preenchido após upload
- Preservar logs claros de diagnóstico no momento da criação do lead.

3. Ajustar a regra de renderização do email
- Tornar a seção PIX mais tolerante:
  - exibir o bloco se houver `pix_code` ou `pix_qrcode_url`
- Tornar o CTA mais resiliente:
  - usar `url_cta` configurada, senão `checkout_url` corrigido a partir do lead/raw payload
- Para PIX pendente, manter o rótulo do botão como “Pagar meu PIX”.

4. Redeploy e validação
- Publicar novamente:
  - `webhook-vega`
  - `send-recovery-email`
- Validar com um novo PIX:
  - lead salvo com `total_value = 5`
  - `checkout_url` preenchido
  - `pix_code` preenchido
  - `pix_qrcode_url` preenchido
- Confirmar no email recebido:
  - valor correto
  - QR Code visível
  - Copia e Cola visível
  - botão CTA funcionando

Detalhes técnicos
- Não precisa nova tabela.
- O bucket `pix-qrcodes` já existe e a política pública de leitura/upload já está criada.
- A correção importante é adicionar fallback no envio do email usando `raw_payload`, porque isso também recupera leads já criados com dados incompletos.
- Assim, a solução cobre:
  - novos leads futuros
  - e também os leads recentes que hoje já têm os dados no payload bruto, mas não nos campos normalizados.

Resultado esperado
- O próximo email de PIX pendente da Vega deverá sair com:
  - valor certo: R$ 5,00
  - QR Code
  - Código Copia e Cola
  - botão para a página do PIX
- E o sistema ficará mais robusto mesmo se algum lead vier parcialmente salvo no futuro.
