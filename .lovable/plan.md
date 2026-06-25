# Cobrança do download manual da NF-e

## Entendimento

Hoje na aba **Envios** o botão "Baixar NF-e" gera o PDF 100% no navegador (`generateDanfePdfBase64` em `src/pages/Envios.tsx`), sem passar pelo backend e sem debitar saldo. A cobrança de `custo_nfe_email` (0,50) só acontece quando o fluxo de email atinge o evento marcado como `enviar_nfe_pdf` (`send-email`, `advance-shipments`, `email-trigger`).

Resultado: o usuário pode baixar a DANFE manualmente e enviar por fora, nunca pagando os 0,50.

Objetivo:
- Se o usuário **ainda não pagou** pela NF-e desse envio → cobra 0,50 no download manual e marca como pago.
- Se o usuário **já pagou** (porque o fluxo de email já cobrou OU porque ele já baixou antes) → download liberado sem nova cobrança.
- O fluxo de email também não pode cobrar de novo se o download manual já tiver cobrado.

## Como vai funcionar (resumido para o usuário)

1. Clica em "Baixar NF-e" no envio:
   - Primeira vez e ainda não cobrado pelo email → desconta 0,50 do saldo, gera o PDF e marca como pago.
   - Já cobrado anteriormente (pelo email ou por download anterior) → baixa de graça.
2. Se o fluxo de email enviar a NF-e por email, ele cobra os 0,50 normalmente e marca como pago — então qualquer download posterior é gratuito.
3. Sem saldo? Toast amigável ("Saldo insuficiente para baixar a NF-e") e nada acontece.

## Mudanças técnicas

### 1. Banco (migração)
- Coluna nova em `envios`: `nfe_cobrado boolean NOT NULL DEFAULT false`.
  - Marca quando a NF-e daquele envio já foi cobrada (por email ou por download).
- (Sem nova policy — segue as policies atuais de `envios`.)

### 2. Edge function nova: `supabase/functions/download-nfe/index.ts`
- Recebe `{ envio_id }`. Valida JWT do usuário e checa `user_owns_loja`.
- Carrega o envio + empresa.
- Decide cobrança:
  - Se `envios.nfe_cobrado = true` → pula débito.
  - Senão → lê `custo_nfe_email` em `system_config` (default 0,5), chama `debit_user_credits` com descrição `"Download manual NF-e <envio_id>"`. Se falhar por saldo, retorna 402 com mensagem. Em sucesso, faz `UPDATE envios SET nfe_cobrado = true WHERE id = ...`.
- Gera o PDF server-side reutilizando a função `generateDanfePdf` que já existe em `resend-nfe/index.ts` (copiada para a nova função, já que edge functions não compartilham módulos além de `_shared/`).
- Retorna o PDF como `application/pdf` base64 no JSON (mesmo formato que o client já consome) para evitar mexer no fluxo de download do browser.

### 3. `src/pages/Envios.tsx` (handleDownloadNfe)
- Troca a geração local por `supabase.functions.invoke("download-nfe", { body: { envio_id } })`.
- Trata erros: saldo insuficiente (402), sem permissão, etc.
- Mantém o `link.click()` com o base64 retornado.
- Remove o import não usado de `generateDanfePdfBase64` se não houver mais consumidor.

### 4. `supabase/functions/send-email/index.ts` e `supabase/functions/advance-shipments/index.ts`
- Quando o evento corrente tem `enviar_nfe_pdf` e a cobrança do email inclui `custo_nfe_email`, marcar `envios.nfe_cobrado = true` no mesmo passo do débito (apenas se o débito foi bem-sucedido). Idempotente: se já era `true`, nada muda.
- Se já estava `true` (usuário baixou antes), **não cobrar de novo** o `custo_nfe_email`, mas continuar enviando o email normalmente (o PDF segue anexado). Isso requer descontar `custo_nfe_email` do total quando `nfe_cobrado=true`.

### 5. Segurança / anti-burla
- A geração do PDF passa a ser exclusivamente server-side; o client não consegue mais montar a DANFE sem invocar a edge function autenticada.
- A função valida posse da loja antes de qualquer débito ou geração.
- A flag `nfe_cobrado` é atualizada na mesma transação lógica do débito (após `debit_user_credits` retornar `true`), evitando cobrar e não marcar.
- `lib/nfe-utils.ts` (`generateDanfePdfBase64`) deixa de ser chamado pelo client; opcionalmente removo o arquivo para não permitir reuso futuro inadvertido.

## Pontos de confirmação

- Valor de 0,50 vem de `system_config.custo_nfe_email` (mesmo já usado pelo email). Confirma que devemos usar exatamente esse valor para o download manual?
- Quando o admin (impersonando) baixa a NF-e: cobrar do dono da loja igualmente, ou liberar sem débito? (proponho cobrar do dono, igual ao fluxo normal).
