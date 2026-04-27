# Live View — Isolamento por Loja

Hoje a página exibe dados simulados que são iguais para todos. Vamos torná-la **real** e **multi-tenant**: cada lojista verá apenas os visitantes que estão consultando os links de rastreio das **suas próprias lojas**.

## Como funciona o rastreamento

Toda vez que alguém abre a página pública de rastreio (`/r/:codigo`), o frontend já chama a edge function `rastreio-info` para buscar os dados do envio. Vamos aproveitar essa chamada — que **já sabe** qual é a `loja_id` do código rastreado — para registrar um **"ping" de presença** numa nova tabela.

```text
Cliente final abre /r/BR123…JL
          │
          ▼
   rastreio-info (edge function)
          │
          ├─► retorna dados (como hoje)
          └─► INSERT em live_view_pings (loja_id, codigo, geo, session_id)
```

A página Live View do lojista lê apenas pings da sua loja (RLS), agrupando por `session_id` e considerando "ativo" quem fez ping nos últimos 60 segundos.

O frontend público envia um **heartbeat** a cada 30 s enquanto a aba fica aberta, para manter o visitante "vivo".

## Banco de dados

Nova tabela `live_view_pings`:

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `loja_id` | uuid NOT NULL | filtro principal |
| `session_id` | text NOT NULL | gerado no browser, dura a sessão da aba |
| `codigo_rastreio` | text | código consultado |
| `cidade` | text | via geo-IP (Cloudflare/Deno headers) |
| `estado` | text | |
| `pais` | text | |
| `pais_codigo` | text(2) | "BR", "US"… |
| `lat` | numeric | |
| `lng` | numeric | |
| `user_agent` | text | curto |
| `last_seen_at` | timestamptz | atualizado a cada heartbeat |
| `created_at` | timestamptz | primeira visita |

**RLS:**
- `service_role` → tudo (a edge function escreve)
- Dono da loja (`user_owns_loja`) → SELECT
- Sem INSERT/UPDATE direto do frontend autenticado

**Índices:** `(loja_id, last_seen_at DESC)`, `(session_id, codigo_rastreio)`.

**Limpeza:** registros com `last_seen_at` > 24h podem ser apagados por uma rotina simples na edge function (best-effort, não cron) — mantém a tabela enxuta sem trabalho extra.

## Geolocalização

Sem dependências pagas. Usamos o que já vem nos headers da requisição:
1. `cf-ipcountry`, `x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-latitude`, `x-vercel-ip-longitude` quando disponíveis.
2. Fallback: `ipapi.co/{ip}/json/` (gratuito, ~1k req/dia — suficiente, e só rodamos no **primeiro ping** da sessão; heartbeats reusam o registro).
3. Se nada funcionar: marcamos como "Desconhecido" sem coordenadas (visitante entra na contagem mas não no globo).

## Edge function

**Modificar `rastreio-info`** para também registrar o ping:
- Recebe novo query param `session_id` (uuid gerado no client).
- `UPSERT` por `(session_id, codigo_rastreio)`:
  - se existe → atualiza `last_seen_at = now()`
  - se não existe → resolve geo + insere
- Falhas no ping **não** quebram a resposta de tracking (try/catch silencioso).

## Frontend

### Página pública de rastreio (`src/pages/Rastreio.tsx`)
- Gera `session_id` no `sessionStorage` (uma vez por aba).
- Envia `?codigo=…&session_id=…` na chamada inicial.
- Inicia `setInterval` de **30 s** chamando `rastreio-info` (heartbeat) enquanto a aba está visível e o usuário está na página de rastreio.
- Pausa quando `document.visibilityState !== 'visible'`.

### Página Live View (`src/pages/LiveView.tsx`)
- Substitui o hook `useLiveVisitors` (mock) por `useLiveVisitorsRealtime(lojaId)`:
  - Busca pings da loja ativa onde `last_seen_at > now() - 60s`.
  - Refetch a cada 5 s + assina canal Realtime de `live_view_pings` filtrando por `loja_id`.
  - Agrega por cidade para os marcadores (mantém limite de 50).
  - Mantém "Pico em 24h" via query separada (max simultâneo no dia).
- Histórico (sparklines): usamos uma janela em memória dos últimos 30 snapshots (mesmo padrão atual).
- Estado vazio bonito quando a loja ainda não tem visitas (em vez de mock).

## Arquivos

**Migração:**
- Criar tabela `live_view_pings` + RLS + índices.
- Habilitar `REPLICA IDENTITY FULL` e adicionar à `supabase_realtime`.

**Editados:**
- `supabase/functions/rastreio-info/index.ts` — registrar ping + geo.
- `src/pages/Rastreio.tsx` — heartbeat + session_id.
- `src/pages/LiveView.tsx` — usar hook real, passar `loja.id`.

**Novos:**
- `src/hooks/useLiveVisitorsRealtime.ts` — hook que lê do Supabase + Realtime.

**Removível depois (mantido por ora como fallback se não houver dados):**
- `src/hooks/useLiveVisitors.ts` — pode ser deletado quando confirmarmos que está tudo funcionando.

## Privacidade & segurança

- Não armazenamos IP cru, só cidade/país/coordenadas aproximadas.
- `session_id` é aleatório, sem PII.
- RLS garante que loja A nunca vê pings da loja B, nem mesmo via API.
- Rate-limit natural: heartbeat de 30 s + UPSERT idempotente.
