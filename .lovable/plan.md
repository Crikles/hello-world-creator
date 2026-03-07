

## Plano: Corrigir filtragem de eventos desativados + criar SMS dos novos fluxos

### Problemas encontrados

1. **Taxação não é filtrada** — quando `ativar_taxacao = false`, os eventos "Taxação" e "Pago" continuam no fluxo (não são removidos da lista de eventos). O e-mail é suprimido, mas o evento ocupa uma etapa desnecessária. Precisa do mesmo tratamento que Falha na Entrega.

2. **Bug no cálculo de status (advance-shipments)** — linha 513 usa `allEvents.length` em vez de `filteredEvents` (a lista filtrada). Isso causa cálculo errado de `em_transito` / `saiu_para_entrega` / `entregue`.

3. **SMS não respeita `isAtivo`** — O dispatch de SMS acontece independentemente de o fluxo estar ativo. Se um evento passa pelo filtro mas tem o envio de e-mail desativado, o SMS ainda é enviado.

4. **SMS templates faltando** — Não existem templates de SMS para `Reenvio Pago` e `Reenvio Saiu`.

### Correções

#### 1. Filtrar Taxação/Pago nos dois lados

**`src/lib/email-trigger.ts`** (~linha 64) e **`advance-shipments/index.ts`** (~linha 350):
```typescript
const taxLabels = ["Taxação", "Taxacao", "Pago"];
if (taxLabels.includes(e.status_label || "") && !config.ativar_taxacao) return false;
```

#### 2. Fix status calculation em `advance-shipments/index.ts`

Linha 513-514: trocar `allEvents` por `filteredEvents` (a variável que já existe com os eventos filtrados):
```typescript
const totalEvents = allEvents.length;        // BUG
const eventIndex = allEvents.indexOf(nextEvent); // BUG
// Corrigir para:
const totalEvents = filteredEvents.length;   // usa filteredEvents, não allEvents
const eventIndex = filteredEvents.indexOf(nextEvent);
```

Nota: o parâmetro da função `advanceShipment` já recebe os `filteredEvents` como `allEvents`, mas internamente o nome é confuso. A correção é garantir que o cálculo use a lista correta.

#### 3. Condicionar SMS ao `isAtivo`

Em ambos `email-trigger.ts` e `advance-shipments/index.ts`, mover o dispatch de SMS para dentro do bloco `isAtivo`, ou adicionar verificação equivalente.

#### 4. Inserir SMS templates

Inserir 2 novos registros na tabela `sms_templates`:
- **Reenvio Pago**: "Ola {nome}, pagamento do reenvio confirmado! Seu pedido sera reenviado. Acesse: [{link}]"
- **Reenvio Saiu**: "Ola {nome}, seu pedido saiu para reentrega. Acesse: [{link}] para acompanhar."

### Arquivos alterados
- `src/lib/email-trigger.ts` — filtrar Taxação + SMS condicional
- `supabase/functions/advance-shipments/index.ts` — filtrar Taxação + fix status calc + SMS condicional
- Inserção de dados: 2 novos SMS templates

