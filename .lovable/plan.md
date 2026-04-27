## Diagnóstico

Confirmei que o backend e o Live View estão funcionando corretamente — o problema é que **o site publicado em `rastreio.jltransportelogistica.com` ainda está servindo uma versão antiga do `Rastreio.tsx` que não envia o `session_id` ao chamar `rastreio-info`**.

Evidência:
- Requisição real do site: `GET .../rastreio-info?codigo=BR6ADAE3584DJL` (sem `session_id`).
- Código atual no repo já envia `&session_id=...`, mas a publicação não foi refeita.
- Testei a Edge Function diretamente passando `session_id` → ela inseriu o ping em `live_view_pings` e o Live View passaria a exibi-lo.

A Edge Function exige `session_id` para registrar visitante, então enquanto o site público não for republicado, nada aparece no painel.

## Plano

Tornar o sistema robusto para nunca mais depender da republicação do frontend:

1. **`supabase/functions/rastreio-info/index.ts`** — gerar um `session_id` automático no servidor quando o cliente não enviar (fallback baseado em IP + User-Agent + dia, com hash). Assim, mesmo o build antigo registra o visitante. Quando o cliente moderno enviar `session_id`, ele continua tendo prioridade (sessões mais precisas por aba). Manter o `await` já existente.

2. **`src/pages/Rastreio.tsx`** — sem mudanças funcionais, só garantir que o `session_id` continue sendo enviado (já está). Adicionar fallback de envio também via header `x-lv-session` (já suportado no backend) para casos em que algum proxy strip a query string.

3. **Republicar** o app após as mudanças para que o `rastreio.jltransportelogistica.com` passe a usar o `Rastreio.tsx` atualizado (com heartbeat de 15s + session_id). Isso é feito clicando em "Publish" no topo direito do editor.

## Resultado esperado

- Mesmo um cliente acessando o site **publicado antigo**, o ping é registrado no servidor (sessão deduzida por IP+UA).
- Após a republicação, cada aba do cliente passa a ter um `session_id` próprio + heartbeat de 15s, mostrando o visitante imediatamente no Live View da loja correta.
- Funciona tanto para `rastreio.jltransportelogistica.com` quanto para `vetortransportesltda.com` — a identificação da loja vem do `codigo_rastreio`, não do domínio.

## Detalhes técnicos

```ts
// rastreio-info: fallback de session_id
const fallbackSession = sessionId || (
  "auto:" + await sha256(
    (req.headers.get("x-forwarded-for") || "") +
    (req.headers.get("user-agent") || "") +
    new Date().toISOString().slice(0, 10) // bucket diário
  ).then(h => h.slice(0, 32))
);
```

Sem mudanças de schema, RLS ou realtime — tudo isso já está correto.
