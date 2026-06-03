Plano de correção:

1. Corrigir o link público de pagamento
- Fazer as páginas `/p/:param` e `/f/:param` aceitarem tanto UUID do envio quanto código de rastreio, como `BRCD5A64A157AT`.
- Ajustar as funções `pagamento-info` e `falha-info` para localizar o envio por `id` ou por `codigo_rastreio`.
- Assim, o link `https://atlas-cargo.org/p/BRCD5A64A157AT` não cairá mais em “Link inválido ou expirado”.

2. Adicionar o botão visível no site da logística
- No evento “Falha Entrega”, exibir um botão destacado abaixo do texto da timeline: `PAGAR REENVIO`.
- O botão levará para a página personalizada de reenvio usando o código de rastreio do cliente.
- Para “Taxação”, manter botão equivalente `PAGAR TAXA` apontando para a página de pagamento da taxa.

3. Fazer o e-mail usar exatamente o preview da aba Postagens
- Ajustar `send-email` para montar o e-mail de “Falha na Entrega” usando as configurações salvas no template ativo da aba Postagens: mensagem, valor, cores, botão e layout do preview.
- Garantir que o CTA do e-mail leve para a mesma página pública personalizada de pagamento, sem cair no template genérico.

4. Publicar as funções alteradas
- Após implementar, fazer deploy das Edge Functions afetadas para a correção valer nos envios reais de e-mail e nas páginas públicas.