

## Plano: Adicionar "Recebedor (Vizinho)" no Evento de Entregue

### Conceito
Quando o status é "Entregue", exibir na página de rastreio e no email dados de um suposto recebedor (vizinho do comprador). O sistema gerará aleatoriamente um nome e CPF mascarado a partir de uma lista fixa de 5 nomes e 5 CPFs.

### Implementação

**Arquivo 1: `src/pages/Rastreio.tsx`** (2 locais — desktop e mobile timeline)
- No `case "Entregue"`, além do `locationText`, gerar um nome e CPF aleatório baseado no `envio.id` (usar hash determinístico para que o mesmo envio sempre mostre o mesmo vizinho)
- Exibir abaixo da localização:
  ```
  Recebedor: Maria Aparecida (Vizinho(a) de João)
  Documento: ***.456.789-**
  ```
- Lista fixa de 5 nomes: ["Maria Aparecida", "José Carlos", "Ana Paula", "Carlos Eduardo", "Fernanda Silva"]
- Lista fixa de 5 CPFs mascarados: ["***.234.567-**", "***.891.012-**", "***.456.789-**", "***.123.654-**", "***.987.321-**"]

**Arquivo 2: `src/components/postagens/emailTemplates.ts`**
- Atualizar o template "Entregue" para incluir texto sobre o recebedor com placeholders `{{recebedor_nome}}` e `{{recebedor_cpf}}`

**Arquivo 3: `supabase/functions/send-email/index.ts`**
- Na função `replaceVariables` ou no momento do envio do email "Entregue", gerar o nome/CPF aleatório (mesma lógica determinística baseada no envio_id) e substituir os placeholders `{{recebedor_nome}}` e `{{recebedor_cpf}}`

### Lógica de aleatoriedade determinística
Usar um hash simples do `envio.id` para selecionar o índice (0-4) nos arrays, garantindo que o mesmo envio sempre mostre o mesmo vizinho em qualquer lugar (email, rastreio, etc.)

```text
index = simpleHash(envio_id) % 5
nome = NOMES[index]
cpf = CPFS[index]
```

O primeiro nome do `cliente_nome` será usado para "Vizinho(a) de {nome}".

