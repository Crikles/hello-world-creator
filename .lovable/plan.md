

# Corrigir envio de email com PDF da Nota Fiscal

## Problema

O email da Nota Fiscal falha porque o PDF em base64 (~500KB+) e enviado no corpo da requisicao para a Edge Function, causando timeout de conexao: "end of file before message length reached". Emails sem anexo (como "Coletado") funcionam normalmente.

## Solucao

Fazer upload do PDF para o Supabase Storage antes de chamar a Edge Function. A Edge Function recebe apenas a URL do arquivo, faz download dele e anexa ao email via Resend.

## Fluxo corrigido

```text
Frontend gera PDF base64
       |
       v
Upload para Storage (bucket "nfe-pdfs")
       |
       v
Chama send-email com nfe_storage_path (string leve)
       |
       v
Edge Function faz download do PDF do Storage
       |
       v
Converte para base64 e anexa ao email via Resend
```

## Mudancas Tecnicas

### 1. Criar bucket "nfe-pdfs" (migracao SQL)

Bucket privado para armazenar os PDFs temporarios das notas fiscais. Politica RLS permite upload por usuarios autenticados.

### 2. Alterar `src/lib/email-trigger.ts`

Em vez de enviar `nfe_pdf_base64` no body da requisicao:
- Converter o base64 em Blob
- Fazer upload para `nfe-pdfs/{envioId}/{filename}`
- Enviar apenas `nfe_storage_path` e `nfe_filename` para a Edge Function

### 3. Alterar `supabase/functions/send-email/index.ts`

- Aceitar novo campo `nfe_storage_path` no request (alem do antigo `nfe_pdf_base64` para compatibilidade)
- Se `nfe_storage_path` existir: fazer download do arquivo via Storage API usando service role
- Converter o buffer para base64 de forma segura (em chunks para evitar stack overflow)
- Anexar ao email normalmente via Resend
- Remover o arquivo do Storage apos envio bem-sucedido (limpeza)

## Arquivos alterados/criados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar bucket `nfe-pdfs` + politicas RLS |
| `src/lib/email-trigger.ts` | Upload do PDF para Storage em vez de enviar base64 no body |
| `supabase/functions/send-email/index.ts` | Receber path do Storage, baixar PDF, anexar e limpar |

