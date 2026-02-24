

# Logo nos Emails, Anexo de NF-e em PDF e Nome Aleatorio

## Resumo

Tres mudancas:
1. **Logo da empresa nos emails** - O template de email passara a exibir a logo da empresa (do campo `logo_url` da tabela `empresas`) no cabecalho do email, personalizado por conta
2. **Anexar PDF da NF-e ao email** - Quando o evento tiver `enviar_nfe_pdf = true`, o cliente gera o PDF da DANFE e envia como base64 para a edge function, que anexa ao email via Resend
3. **Nome aleatorio para o arquivo da NF-e** - O PDF anexado tera nome no formato `NF-e34339292201_49392.pdf` (numeros aleatorios)

## Detalhes por mudanca

### 1. Logo da empresa no email

**`src/components/postagens/emailTemplates.ts`**:
- Adicionar variavel `{{empresa_logo_url}}` na lista de variaveis disponiveis
- Alterar a funcao `buildEmailHtml` para incluir uma tag `<img>` no cabecalho do email quando `{{empresa_logo_url}}` estiver preenchida
- O cabecalho passara de apenas texto para logo + texto

**`supabase/functions/send-email/index.ts`**:
- Ao buscar dados da empresa, incluir `logo_url` no select
- Adicionar `empresa_logo_url` e `empresa_nome` no replaceVariables para que o template HTML gerado contenha a logo correta
- O `corpo_email` do evento ja usa o template HTML gerado pelo `buildEmailHtml`, entao as variaveis serao substituidas automaticamente

### 2. Anexar PDF da NF-e

Como a geracao de PDF depende de html2canvas (precisa de DOM do browser), a estrategia sera:
- **Cliente**: Quando o email tiver `enviar_nfe_pdf = true`, o frontend gera o PDF via html2canvas/jsPDF, converte para base64, e envia junto na request para a edge function
- **Edge function**: Recebe o campo opcional `nfe_pdf_base64` e `nfe_filename`, e usa a API de attachments do Resend para anexar

**`supabase/functions/send-email/index.ts`**:
- Adicionar campos opcionais `nfe_pdf_base64` e `nfe_filename` na interface SendEmailRequest
- No body do Resend, adicionar array `attachments` quando houver PDF:
```typescript
attachments: nfe_pdf_base64 ? [{
  filename: nfe_filename || "NF-e.pdf",
  content: nfe_pdf_base64,
}] : undefined
```

**Frontend (onde o email e disparado)**:
- Antes de chamar a edge function, se o evento tem `enviar_nfe_pdf = true`:
  1. Buscar dados da empresa
  2. Gerar o HTML da DANFE com `getDanfeCssAndBody`
  3. Renderizar com html2canvas e gerar PDF com jsPDF
  4. Converter para base64 (sem o prefixo data:)
  5. Gerar nome aleatorio: `NF-e${randomDigits}_${randomDigits}.pdf`
  6. Enviar `nfe_pdf_base64` e `nfe_filename` na request

### 3. Nome aleatorio do arquivo NF-e

Funcao utilitaria para gerar nome:
```typescript
function generateNfeFilename(): string {
  const part1 = Math.floor(Math.random() * 99999999999).toString().padStart(11, '0');
  const part2 = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `NF-e${part1}_${part2}.pdf`;
}
```

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/postagens/emailTemplates.ts` | Adicionar logo no cabecalho do template HTML e variavel `empresa_logo_url` |
| `supabase/functions/send-email/index.ts` | Buscar logo_url da empresa, incluir no replace de variaveis, suportar attachment de PDF |
| Arquivo do frontend que dispara o envio de email | Gerar PDF da DANFE e enviar como base64 (precisa identificar onde o send-email e chamado) |

## Cabecalho do email com logo

O header do email mudara de:

```text
+------------------------------------------+
|          {{empresa_nome}}                |
+------------------------------------------+
```

Para:

```text
+------------------------------------------+
|    [LOGO]   {{empresa_nome}}             |
+------------------------------------------+
```

Se nao houver logo, mostra apenas o nome (comportamento atual). A logo tera tamanho maximo de 120px de altura para manter a proporcao.

## Consideracoes

- O bucket `logos` ja e publico, entao as URLs das logos funcionarao diretamente no email
- Resend suporta attachments com base64 nativamente
- A geracao do PDF precisa acontecer no browser pois usa html2canvas (nao disponivel em Deno)
- O nome do arquivo sera gerado no frontend antes do envio

