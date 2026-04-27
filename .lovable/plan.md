## Plano — Corrigir Live View para registrar visitantes em tempo real

### Diagnóstico

Confirmei via banco e logs:

1. A tabela `live_view_pings` existe, está com RLS correto (service_role escreve, dono da loja lê) e está no `supabase_realtime`.
2. A edge function `rastreio-info` está sendo chamada normalmente (vários `booted` nos últimos minutos), porém **a tabela está vazia (0 linhas)**.
3. O frontend (`Rastreio.tsx`) está enviando o `session_id` corretamente e fazendo heartbeat de 30s.
4. O domínio `rastreio.jltransportelogistica.com` serve a SPA e abre `/r/:codigo` → componente correto. Sem proxy/redirect intermediário no caminho do cliente final.

**Causa raiz**: a função `recordLivePing` é chamada **sem `await`** (fire-and-forget com `.catch`). Em Deno/Edge Runtime, assim que a `Response` é retornada, o ambiente da request pode ser encerrado antes do `INSERT`/`UPDATE` chegar ao banco. Por isso nenhum ping persiste, mesmo a função sendo invocada.

### Correção

**`supabase/functions/rastreio-info/index.ts`**

1. **Aguardar o ping antes de responder** (`await recordLivePing(...)`) — adiciona ~50–200 ms à página de rastreio, custo aceitável e garante gravação. Envolver em `try/catch` interno para nunca quebrar a resposta.
2. **Aceitar o `session_id` também via header** (`x-lv-session`) como redundância (algumas redes podem podar query strings).
3. **Logar `console.log` no início e no fim do `recordLivePing`** com `loja_id`, `session_id` e resultado (insert/update) para facilitar debug futuro.
4. **Aumentar a robustez do upsert**: usar `upsert` com `onConflict: "session_id, codigo_rastreio"` (já existe um índice único `(session_id, COALESCE(codigo_rastreio, ''))`) em vez de SELECT-then-UPDATE/INSERT, eliminando race conditions e acelerando.

**`src/pages/Rastreio.tsx`**

5. **Reduzir intervalo de heartbeat de 30s → 15s** para sensação mais "ao vivo" e mais resiliente a fechamentos rápidos. (Janela de "online" no hook continua 90s.)
6. **Disparar um heartbeat extra ao voltar `visibilitychange` para visible**, para que minimizar/restaurar a aba reapareça imediatamente no Live View do lojista.

**`src/hooks/useLiveVisitorsRealtime.ts`** — sem mudanças. Já filtra por `loja_id` corretamente e tem Realtime + polling 5 s.

### Resultado esperado

- Ao abrir `https://rastreio.jltransportelogistica.com/r/BR6ADAE3584DJL`, na primeira request o ping é gravado (await garantido) com `loja_id` derivado do `envios.codigo_rastreio = BR6ADAE3584DJL`.
- O Live View da Loja Prime (dona desse envio) recebe o INSERT via Supabase Realtime em < 1 s e mostra o visitante na cidade detectada.
- Mesma lógica funciona para `vetortransportesltda.com`, pois ambos os domínios apontam para a mesma SPA, que chama a mesma `rastreio-info` — a edge function descobre a loja pelo código de rastreio, não pelo domínio.

### Itens fora do escopo

- Lógica de RLS/multi-tenant (já correta).
- Globo, métricas, tabela de atividade (já consomem o hook).
- Identificação por slug "tracking_slug" — não aplicável, já usamos `codigo_rastreio` que cumpre exatamente esse papel e está vinculado ao `loja_id`.