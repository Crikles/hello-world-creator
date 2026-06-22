## Problema

Na aba **Envios**, o contador de etapas (`X/16`) está sempre baseado em `postagem_eventos` (fluxo Nacional). Quando o **Fluxo Global está ATIVO** e o envio é internacional (`is_international = true`), deveria mostrar `X/10` — o total de passos definidos em `global_flow_eventos` para a loja.

## Causa

Em `src/pages/Envios.tsx` a função `getTotalEventos(envio)` consulta apenas o `eventCountMap`, que é montado a partir de `postagem_eventos` (linhas 395–427). Não há consulta ao `global_flow_eventos`, então o total para envios globais cai sempre nos 16 do Nacional.

## Mudanças

### `src/pages/Envios.tsx`

1. **Nova query `globalFlowCount`** (irmã da query `eventCountMap`, condicionada à loja existir):
   - `SELECT count` em `public.global_flow_eventos` com `loja_id = loja.id` e `ativo = true`.
   - Retorna um número (ex.: `10`). Cacheia por loja.

2. **Atualizar `getTotalEventos(envio)`** (linha 856):
   - Se `envio.is_international === true` (ou `envio.global_flow_lang` preenchido), retornar `globalFlowCount` quando disponível (fallback `10`).
   - Caso contrário, manter a lógica atual via `eventCountMap`.

3. **`getProgress` / `canAdvance`** continuam usando `getTotalEventos`, então passam a refletir corretamente `ordem / 10` para envios globais.

4. **Exibição (`linha 1232`)** já usa `getTotalEventos`, então mostrará `X/10` automaticamente.

### Sem mudanças em backend

`ultimo_evento_ordem` já é incrementado de 1 a 10 pelo avanço do Fluxo Global (a tabela `global_flow_eventos` tem `step_order` 1..10). Apenas o total exibido estava errado.

## Validação

Após aplicar:
- Loja com Fluxo Global ATIVO e envio internacional → cartão mostra `0/10` (ou `n/10` conforme avança).
- Envio Nacional na mesma loja continua `X/16` (ou o que o template definir).
