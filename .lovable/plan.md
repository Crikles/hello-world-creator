## Problema

Os painéis **Taxação** e **Falha na Entrega** estão vazios, e o cron de avanço automático não está pausando nesses eventos. Isso acontece porque o código continua filtrando pelo campo `status_label` (que agora contém texto editável pelo lojista, ex.: "Falha na entrega — pagar reenvio") em vez de pelo campo `nome` (identificador técnico estável: "Falha Entrega" / "Taxação" / "Pago").

Confirmado no banco: há lead `BRCD5A64A157AT` parado em ordem=7 com `nome="Falha Entrega"` e `status_label="Falha na entrega — pagar reenvio"`, mas o painel não mostra porque o filtro busca `status_label="Falha Entrega"`.

## Correções

### 1. `src/pages/Taxacao.tsx`
- Trocar `.in("status_label", ["Taxação","Pago"])` → `.in("nome", ["Taxação","Pago"])`.
- Trocar `.find(e => e.status_label === "Taxação"/"Pago")` → `.find(e => e.nome === ...)`.

### 2. `src/pages/FalhaEntrega.tsx`
- Trocar `.in("status_label", ["Falha Entrega"])` → `.in("nome", ["Falha Entrega"])`.
- Trocar `.find(e => e.status_label === "Falha Entrega" || e.nome === "Falha na Entrega")` → `.find(e => e.nome === "Falha Entrega")`.

### 3. `src/lib/email-trigger.ts`
Substituir todas as comparações de `status_label` por `nome` nos blocos de:
- Filtro `falhaLabels = ["Falha Entrega","Pago"]` e `taxLabels = ["Taxação","Pago"]` (linhas ~76-87).
- Verificação `isAtivo` para decidir se envia e-mail (linhas ~252-262).

### 4. `supabase/functions/advance-shipments/index.ts`
- Substituir o filtro SQL `.not("status_label","in",'("Falha Entrega","Taxação","Taxacao")')` por filtro equivalente em `nome` (`.not("nome","in",'("Falha Entrega","Taxação")')`), garantindo que o cron pause nesses eventos até o lojista aprovar manualmente.
- Atualizar os arrays `falhaLabels`/`taxLabels` e a checagem `isAtivo` (linhas ~440-441, 818-819, 967-971) para comparar por `nome`.

### 5. Deploy
- Redeploy de `advance-shipments` (e também `send-email` se for tocado por consistência, mas a checagem de envio lá já busca o evento pelo id, não pelo label).

## Fluxo final esperado

1. Envio entra com template "Falha na Entrega" → avança automaticamente até `nome="Falha Entrega"` (ordem 7) e **pausa** (cron ignora pelo filtro `nome`).
2. Lead aparece em **/falha-entrega** como Pendente.
3. Lojista clica em **Aprovar** → `triggerNextEmail(..., forceAdvance=true)` avança para `nome="Pago"` (ordem 8) e dispara o e-mail "Reenvio pago".
4. Cron retoma a partir de ordem 8, prosseguindo "Saiu para Entrega (reenvio)" → "Em rota" → "Entregue" normalmente.
5. Mesmo comportamento simétrico para Taxação (`nome="Taxação"` pausa, "Pago" libera).

## Detalhes técnicos

- `nome` é o identificador técnico estável (já usado nos componentes de configuração após correções anteriores).
- `status_label` é texto livre exibido ao cliente final (página de rastreio/e-mail), portanto não serve como chave de roteamento.
- Nenhuma mudança de schema é necessária — apenas ajustes de filtros no código.
