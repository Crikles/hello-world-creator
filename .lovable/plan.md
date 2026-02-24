

# Email Personalizado com Design e Dominio Proprio

## Problemas Encontrados

1. **Email sem design**: O campo `corpo_email` na tabela `postagem_eventos` contem HTML simples (`<p>Ola...</p>`), e a edge function envia esse conteudo diretamente sem aplicar o template bonito que ja existe em `buildEmailHtml()` (com header colorido, logo, tabela de info do pedido, botao CTA, rodape).

2. **Remetente errado**: O endereco "from" esta fixo como `onboarding@resend.dev` (linha 164 da edge function). Precisa usar `noreply@jltransportes.pro`.

---

## Solucao

### 1. Adicionar campo `email_remetente` na tabela `postagem_config`

Um novo campo para cada loja poder configurar o email de envio. Valor padrao: `noreply@jltransportes.pro`.

```sql
ALTER TABLE public.postagem_config
  ADD COLUMN email_remetente TEXT DEFAULT 'noreply@jltransportes.pro';
```

### 2. Replicar a logica do template HTML na Edge Function

Copiar a funcao `buildEmailHtml()` de `emailTemplates.ts` para dentro da edge function `send-email/index.ts`. Em vez de enviar o `corpo_email` cru, a edge function vai:

- Parsear os campos de secoes do evento (saudacao, mensagem, info do pedido, CTA, rodape)
- Gerar o HTML completo com header gradiente, logo da empresa, tabela de dados, botao e rodape
- Substituir as variaveis (cliente_nome, produto, etc.)
- Enviar o HTML final bonito via Resend

Como o `corpo_email` atual armazena HTML simples, a edge function vai detectar se o conteudo e HTML basico e envolvera no template completo.

### 3. Alterar o "from" na Edge Function

Trocar a linha hardcoded:
```
from: `${fromName} <onboarding@resend.dev>`
```
Por:
```
from: `${fromName} <${emailRemetente}>`
```
Onde `emailRemetente` vem do campo `postagem_config.email_remetente` da loja, buscado no inicio da funcao.

### 4. Passar `loja_id` para buscar config na Edge Function

A edge function ja recebe `loja_id`. Vai usalo para buscar `postagem_config` e pegar o `email_remetente`.

---

## Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar coluna `email_remetente` em `postagem_config` |
| `supabase/functions/send-email/index.ts` | Adicionar template HTML bonito + buscar email remetente da config |
| `src/pages/Configuracoes.tsx` ou `src/pages/Postagens.tsx` | Adicionar campo para editar o email remetente (opcional) |

## Resultado Esperado

O email enviado tera:
- Header com gradiente e logo da empresa
- Nome da empresa em destaque
- Saudacao personalizada
- Mensagem formatada com negrito
- Tabela com dados do pedido (produto, rastreio, transportadora, valor)
- Botao CTA estilizado
- Rodape elegante
- Remetente: `Empresa <noreply@jltransportes.pro>`
