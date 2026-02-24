

# Corrigir Disparo de Emails e Redesign Visual

## Problemas Identificados

### 1. Emails nao sao disparados corretamente
O sistema atual tem um mapeamento incorreto: quando o status muda para `em_transito`, ele busca eventos com labels ["Coletado", "Em Transito", "Em Rota", "Centro Local"] mas **envia apenas o primeiro** (linha 54 do `email-trigger.ts`: `const event = events[0]`). Os demais eventos nunca sao disparados.

O template "Nacional Padrao" do usuario tem 6 eventos sequenciais, mas o sistema so tem 4 status internos (pendente, em_transito, saiu_para_entrega, entregue), causando perda de eventos intermediarios.

### 2. Transportadora vazia
O campo `transportadora` nos envios esta `null` no banco de dados. Nenhum valor esta sendo salvo.

### 3. Visual do email fraco
O design atual usa um gradiente generico com a logo sem tratamento.

---

## Solucao

### 1. Corrigir disparo: enviar TODOS os eventos correspondentes

Alterar `src/lib/email-trigger.ts` para iterar sobre **todos** os eventos correspondentes ao status (nao apenas o primeiro). Quando o status muda para `em_transito`, o sistema enviara os emails de "Coletado", "Em Transito", "Centro Local" (todos que estao mapeados para aquele status interno).

```text
ANTES: const event = events[0];  // so o primeiro
DEPOIS: for (const event of events) { ... }  // todos os eventos
```

Cada evento sera verificado individualmente quanto ao flag `isAtivo` e `enviar_email` antes do disparo.

### 2. Transportadora padrao

No `supabase/functions/send-email/index.ts`, quando o campo `transportadora` do envio estiver vazio, usar o valor padrao: **"JL Transportadora e Logistica LTDA"**.

### 3. Redesign completo do email

Novo layout do email no `buildEmailHtml` da Edge Function:

```text
+------------------------------------------+
|                                          |
|    [LOGO REDONDA - fundo branco]         |
|    Circulo branco com a logo dentro      |
|                                          |
+------------------------------------------+
|  FUNDO PRETO / ESCURO                    |
|                                          |
|  EMOJI + TITULO EM BRANCO               |
|  Ex: "🚚 Saiu para Entrega!"            |
|  Ex: "📦 Pedido Coletado"               |
|  Ex: "✅ Pedido Entregue!"              |
|                                          |
+------------------------------------------+
|                                          |
|  Saudacao + mensagem (fundo branco)      |
|                                          |
|  +------------------------------------+ |
|  | Produto    | Tenis Premium         | |
|  | Rastreio   | BR547454312HF         | |
|  | Transporte | JL Transportadora...  | |
|  | Valor      | R$ 89,90              | |
|  +------------------------------------+ |
|                                          |
|  [  BOTAO CTA  ]                        |
|                                          |
+------------------------------------------+
|  Rodape cinza                            |
+------------------------------------------+
```

Emojis por evento:

| Evento | Emoji |
|---|---|
| Nota Fiscal / Postado | 📄 |
| Coletado | 📦 |
| Em Transito | 🚛 |
| Centro Local | 📍 |
| Em Rota | 🏍️ |
| Saiu para Entrega | 🚚 |
| Entregue | ✅ |
| Taxacao | ⚠️ |
| Pago | 💳 |

### 4. Atualizar frontend templates

Sincronizar `src/components/postagens/emailTemplates.ts` com o novo visual e emojis nos titulos.

---

## Detalhes Tecnicos

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/lib/email-trigger.ts` | Loop por todos os eventos correspondentes em vez de so o primeiro |
| `supabase/functions/send-email/index.ts` | Transportadora padrao + redesign HTML completo (logo redonda, header preto, emojis) |
| `src/components/postagens/emailTemplates.ts` | Sincronizar emojis e visual nos defaults do editor |

### Mudanca no email-trigger.ts

```text
ANTES:
  const event = events[0];
  // verifica isAtivo, gera PDF, invoca edge function

DEPOIS:
  for (const event of events) {
    // verifica isAtivo para CADA evento
    // gera PDF apenas se enviar_nfe_pdf
    // invoca edge function para CADA evento ativo
  }
```

### Mudanca no send-email (Edge Function)

1. **Transportadora fallback**: Se `envio.transportadora` for vazio, usar "JL Transportadora e Logistica LTDA"
2. **Logo redonda**: Envolver a imagem em um circulo branco com `border-radius:50%`
3. **Header preto**: Background `#1a1a1a` ou `#111111` com texto branco
4. **Emojis no titulo**: Mapa de emojis por `status_label` concatenado ao titulo
5. **Tabela de info**: Manter estilo limpo com bordas suaves

