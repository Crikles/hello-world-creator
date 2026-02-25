

# Corrigir Disparo de Emails: 1 Clique = 1 Email

## Problema

O sistema tem apenas 4 status internos (pendente, em_transito, saiu_para_entrega, entregue), mas o fluxo de email tem 6 eventos. Quando voce clica para avancar, o sistema muda o status e dispara TODOS os emails mapeados para aquele status de uma vez, em vez de enviar apenas o proximo.

## Solucao

Adicionar um campo `ultimo_evento_ordem` na tabela de envios para rastrear qual foi o ultimo email enviado. Cada clique no botao de avancar envia apenas o **proximo** evento da fila.

### Como vai funcionar

```text
Clique 1: evento ordem 1 (Nota Fiscal)      -> status: em_transito
Clique 2: evento ordem 2 (Coletado)          -> status: em_transito
Clique 3: evento ordem 3 (Em Transito)       -> status: em_transito
Clique 4: evento ordem 4 (Centro Distrib.)   -> status: em_transito
Clique 5: evento ordem 5 (Saiu p/ Entrega)   -> status: saiu_para_entrega
Clique 6: evento ordem 6 (Entregue)          -> status: entregue
```

A barra de progresso vai avancar proporcionalmente: 0% -> 17% -> 33% -> 50% -> 67% -> 83% -> 100%.

---

## Detalhes Tecnicos

### 1. Migracao de banco de dados

Adicionar coluna `ultimo_evento_ordem` (integer, default 0) na tabela `envios`.

### 2. Reescrever `src/lib/email-trigger.ts`

Nova funcao `triggerNextEmail` que:
- Busca o template ativo da loja
- Busca TODOS os eventos do template ordenados por `ordem`
- Filtra apenas o proximo evento (onde `ordem > ultimo_evento_ordem`)
- Envia apenas ESSE evento
- Atualiza `ultimo_evento_ordem` no banco
- Calcula e atualiza o status interno baseado na posicao do evento no fluxo total

Mapeamento de status por posicao:
- Evento e o ultimo do fluxo -> status `entregue`
- Evento e o penultimo -> status `saiu_para_entrega`
- Qualquer outro -> status `em_transito`

### 3. Atualizar `src/pages/Envios.tsx`

- Botao de avancar por linha: chamar `triggerNextEmail` em vez de mudar status diretamente
- Barra de progresso: calcular baseado em `ultimo_evento_ordem / total_eventos` em vez do status fixo
- "Iniciar Pendentes": envia apenas o primeiro email (ordem 1) para cada pendente
- "Avancar Todos": envia o proximo email de cada envio (1 por envio, nao todos)
- Esconder botao de avancar quando `ultimo_evento_ordem` ja chegou ao ultimo evento

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | Adicionar coluna `ultimo_evento_ordem` |
| `src/lib/email-trigger.ts` | Nova logica: buscar proximo evento, enviar 1, atualizar ordem |
| `src/pages/Envios.tsx` | Botoes chamam nova funcao, progresso dinamico |

