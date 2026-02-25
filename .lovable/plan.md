

# Integracao SMS via Integrax - Disparo no "Pedido Coletado"

## Resumo

Quando o toggle "Site do rastreio por SMS" estiver ativo, o sistema enviara um unico SMS ao cliente no momento do evento com status_label "Coletado". O SMS contem o primeiro nome do cliente e o link de rastreio personalizado, sem acentos, com no maximo 150 caracteres.

## Exemplo de SMS

```text
Ola Maria, seu codigo de rastreio foi liberado, fique atento a seu email, acesse: https://rastreio.logisticajltransportes.com/r/BRABC1234567
```

## Mudancas

### 1. Salvar secret INTEGRAX_API_KEY

Token: `55104f2b-cdd9-4e8c-9d7a-a2f83fcc2ff1`

### 2. Criar Edge Function `send-sms`

**Arquivo:** `supabase/functions/send-sms/index.ts`

Endpoint da API: `https://sms.aresfun.com/v1/integration/{TOKEN}/send-sms`

Fluxo:
1. Recebe `envio_id` e `loja_id` no body
2. Busca o envio no banco: `cliente_nome`, `cliente_telefone`, `codigo_rastreio`
3. Valida que `cliente_telefone` existe
4. Extrai primeiro nome do cliente
5. Remove acentos com `normalize("NFD").replace(/[\u0300-\u036f]/g, "")`
6. Monta mensagem: `Ola {nome}, seu codigo de rastreio foi liberado, fique atento a seu email, acesse: https://rastreio.logisticajltransportes.com/r/{codigo}`
7. Trunca em 150 caracteres
8. Formata telefone para `55XXXXXXXXXXX` (limpa caracteres especiais, prefixa 55 se necessario)
9. POST para `https://sms.aresfun.com/v1/integration/55104f2b-cdd9-4e8c-9d7a-a2f83fcc2ff1/send-sms` com payload:
   ```json
   { "to": ["5511999999999"], "from": "29094", "message": "..." }
   ```
10. Retorna sucesso/erro

Adicionar `verify_jwt = false` no `supabase/config.toml`.

### 3. Alterar `src/lib/email-trigger.ts`

Apos o bloco de envio de email (apos linha 134), adicionar verificacao:
- Se `config.ativar_site_rastreio === true`
- Se `nextEvent.status_label === "Coletado"`
- Se o envio possui `cliente_telefone`

Se todas verdadeiras, invocar `supabase.functions.invoke("send-sms", { body: { envio_id, loja_id } })`.

O SMS e disparado apenas uma vez por envio, pois cada evento so e processado uma vez (controle via `ultimo_evento_ordem`).

### 4. Remover badge "em breve" da UI

**Arquivo:** `src/pages/Postagens.tsx`

Na linha 392, remover `<Badge variant="secondary" className="text-xs">em breve</Badge>` da secao "Site do rastreio por SMS".

## Detalhes Tecnicos

### Formato do telefone

O campo `cliente_telefone` sera limpo (remover espacos, parenteses, hifens) e prefixado com "55" se nao comecar com "55", garantindo formato `55XXXXXXXXXXX`.

### Remocao de acentos

```javascript
text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
```

### Arquivos alterados/criados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/send-sms/index.ts` | Criar |
| `supabase/config.toml` | Adicionar config send-sms (automatico) |
| `src/lib/email-trigger.ts` | Adicionar disparo SMS no evento "Coletado" |
| `src/pages/Postagens.tsx` | Remover badge "em breve" |

