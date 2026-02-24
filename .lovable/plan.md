

# Revisar Copys e Titulos dos Templates de Email

## Problema Atual

1. **Titulo do header do email** mostra sempre o nome da loja (ex: "Benedito e Maria Ferragens") para todos os eventos. O usuario quer que mostre a ACAO do pedido (ex: "Pedido Entregue", "Saiu para Entrega"), exceto no email de Nota Fiscal que deve manter o nome da loja.

2. **Assuntos dos emails** sao genericos (ex: "Pedido Entregue - tenis tenis"). Precisam ser mais descritivos e bonitos.

3. **Corpo dos emails** no banco de dados sao `<p>` simples sem personalidade. Precisam de copys melhores.

---

## Solucao

### 1. Alterar header do email na Edge Function (`send-email/index.ts`)

Mudar a logica do `buildEmailHtml` para:
- Se o evento tem `enviar_nfe_pdf = true` (Nota Fiscal): header mostra logo + nome da empresa
- Para todos os outros eventos: header mostra logo + titulo da acao (ex: "Pedido Saiu para Entrega!")

O titulo da acao sera mapeado internamente na edge function com base no `status_label` do evento:

| status_label | Titulo no Header |
|---|---|
| Postado (com NF) | {{empresa_nome}} (mantido) |
| Coletado | Pedido Coletado |
| Em Transito | Pedido em Transito |
| Em Rota | Em Rota de Entrega |
| Centro Local | Centro de Distribuicao |
| Saiu para Entrega | Saiu para Entrega! |
| Entregue | Pedido Entregue! |
| Taxacao | Aviso de Taxacao |
| Pago | Pagamento Confirmado |

### 2. Atualizar assuntos no banco de dados

Atualizar os `assunto_email` de todos os eventos para copys mais profissionais:

| Evento | Assunto Atual | Novo Assunto |
|---|---|---|
| Nota Fiscal Emitida | Nota Fiscal Emitida - {{produto}} | {{empresa_nome}} - Nota Fiscal do seu pedido |
| Pedido Confirmado | Pedido Confirmado - {{produto}} | Seu pedido foi confirmado! |
| Pedido Coletado | Pedido Coletado - {{produto}} | Seu pedido foi coletado pela transportadora |
| Em Transito | Pedido em Transito - {{produto}} | Seu pedido esta a caminho! |
| Em Rota de Entrega | Em Rota de Entrega - {{produto}} | Seu pedido esta em rota de entrega |
| Centro de Distribuicao | Centro de Distribuicao - {{produto}} | Seu pedido chegou ao centro de distribuicao |
| Saiu para Entrega | Saiu para Entrega - {{produto}} | Seu pedido saiu para entrega hoje! |
| Entregue | Pedido Entregue - {{produto}} | Seu pedido foi entregue! |
| Aguardando Pagamento | Pagamento Pendente - Taxacao - {{produto}} | Acao necessaria: seu pedido foi taxado |
| Pagamento Confirmado | Pagamento Confirmado - {{produto}} | Pagamento confirmado - entrega sera retomada |

### 3. Atualizar corpo dos emails no banco de dados

Atualizar os `corpo_email` com mensagens mais calorosas e informativas (mantendo as variaveis):

- **Nota Fiscal**: "Sua nota fiscal foi emitida e esta em anexo. Seu pedido sera enviado em breve!"
- **Pedido Confirmado**: "Otima noticia! Seu pedido foi confirmado e ja estamos preparando tudo para o envio."
- **Pedido Coletado**: "Seu pedido foi coletado pela transportadora {{transportadora}} e esta a caminho!"
- **Em Transito**: "Seu pedido esta viajando ate voce! Acompanhe pelo codigo de rastreio."
- **Em Rota**: "Seu pedido esta na regiao e em rota de entrega."
- **Centro de Distribuicao**: "Seu pedido chegou ao centro de distribuicao mais proximo. Falta pouco!"
- **Saiu para Entrega**: "Boas noticias! Seu pedido saiu para entrega hoje. Fique atento!"
- **Entregue**: "Seu pedido foi entregue com sucesso! Esperamos que voce aproveite."
- **Taxacao**: "Seu pedido foi taxado pela alfandega e precisa de uma acao sua para continuar."
- **Pagamento Confirmado**: "O pagamento da taxa foi confirmado e a entrega sera retomada em breve."

### 4. Atualizar templates padrao no frontend (`emailTemplates.ts`)

Sincronizar os `defaultSectionsByEvent` com as novas copys para que o editor de email mostre os textos corretos.

---

## Detalhes Tecnicos

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/send-email/index.ts` | Logica do header: mostrar acao em vez de nome da loja (exceto NF) |
| `src/components/postagens/emailTemplates.ts` | Atualizar `defaultSectionsByEvent` com novas copys |
| Migracao SQL | UPDATE em massa nos `assunto_email` e `corpo_email` de `postagem_eventos` |

### Mudanca no header da Edge Function

No `buildEmailHtml`, a variavel que aparece no header (`<p>` branco no gradiente) sera determinada assim:

```text
SE evento.enviar_nfe_pdf == true
  headerTitle = empresaNome  (ex: "Benedito e Maria Ferragens")
SENAO
  headerTitle = mapa de titulos por status_label  (ex: "Pedido Entregue!")
```

A logo da empresa continuara aparecendo em TODOS os emails no header.

