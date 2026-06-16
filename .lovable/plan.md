## Causa raiz

O e-mail de NF-e está sendo enviado (template "Nota Fiscal Emitida" chega corretamente), mas **sem o PDF anexado**. Investigando os logs da função `advance-shipments`, todo upload do PDF da DANFE está falhando com:

```
PDF upload failed ... StorageApiError: Bucket not found (status 404)
```

Confirmado via consulta em `storage.buckets`: o bucket `nfe-pdfs` **não existe** no projeto. Sem o upload, `nfe_storage_path` fica vazio e o `send-email` envia o e-mail sem `attachments`, exatamente o que aparece no print do Resend (apenas o HTML, sem PDF anexo).

Isso também afeta:
- `resend-nfe` (reenvio em massa) — usa o mesmo bucket.
- Qualquer disparo manual que dependa de upload server-side do DANFE.

## Correção

1. **Criar o bucket de storage `nfe-pdfs`** como privado (acesso só pela service role; o `send-email` baixa e remove o arquivo logo após anexar).
2. Sem alterações de código nas Edge Functions — elas já tratam o caso e fazem o upload/download/limpeza corretamente; faltava só a infraestrutura.
3. Disparar manualmente uma execução do `advance-shipments` após criar o bucket, para validar que o próximo envio com etapa NF-e sai com o PDF anexado.
4. Conferir nos logs `advance-shipments` que a mensagem "PDF generated and uploaded server-side" aparece e em `send-email` que aparece "PDF downloaded from storage, size: …".

## Sobre os pedidos já enviados sem PDF

Os e-mails que já saíram durante esse período ficaram sem anexo. Posso, após a correção, agendar um reenvio em lote da etapa NF-e via `resend-nfe` para a(s) loja(s) afetadas — só preciso que você confirme se quer reenviar para todos os pedidos do período ou só de lojas específicas.
