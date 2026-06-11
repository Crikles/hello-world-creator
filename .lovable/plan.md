## Situação atual

Usuário: `vercarosuporte@gmail.com` → loja `16b287dd-...` (Vercaro).

Envios da loja (ativos):
- **214 envios** com template **"Envio com Falha na Entrega"** (`87c93127`) — os que ele escolheu errado.
- **181 envios** com `postagem_template_id = NULL` → já usam o template ativo da loja, que **já é "Envio Prolongado"** (`8fb9200e`). Esses não precisam de nada.

## Mapeamento das etapas

Comparando as ordens dos dois templates, os 5 primeiros eventos batem 1:1:

| Ordem | Falha na Entrega | Envio Prolongado |
|---|---|---|
| 1 | NF-e | NF-e |
| 2 | Postado | Postado |
| 3 | Coletado | Coletado |
| 4 | Em Trânsito | Saiu da unidade de origem (Em Trânsito) |
| 5 | Centro de Distribuição | Passando por centro de triagem (Em Trânsito) |

Distribuição atual dos 214 envios: 103 na ordem 2, 72 na 3, 38 na 4, 1 na 5. **Todos caem em etapas equivalentes**, então manter o mesmo `ultimo_evento_ordem` preserva a posição do cliente na timeline.

## Ação

Um único UPDATE:

```sql
UPDATE envios
SET postagem_template_id = '8fb9200e-d9b7-46e5-a132-218ff90538d7' -- Envio Prolongado
WHERE loja_id = '16b287dd-ae5d-4c39-9fe6-a617ec80da9a'
  AND postagem_template_id = '87c93127-9307-4474-8bd3-0dde51caa10f'
  AND deleted_at IS NULL;
```

- Mantém `ultimo_evento_ordem` e `status` intactos → cada envio fica exatamente na mesma etapa, só que com os labels e o avanço futuro vindo do template Prolongado.
- Aplica também aos mais antigos (sem filtro de data).
- Não mexo nos 181 envios com `NULL` (já estavam usando Prolongado pela config ativa da loja).
- Não mexo na config da loja — `template_ativo_id` já é Prolongado.

Sem mudanças de schema, sem código tocado.
