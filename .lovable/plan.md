## Objetivo

JL e Vetor estão sendo descontinuados. Qualquer acesso aos domínios `rastreio.jltransportelogistica.com` (e qualquer `*.jltransportelogistica.com`) e `vetortransportesltda.com` (e `www.`) deve redirecionar para `atlas-cargo.org`, **preservando o path** (`/r/CODIGO`, `/p/ID`, `/f/ID`, etc.). Links já enviados também passam a cair na Atlas.

## Mudanças

### 1. `index.html` — redirect imediato no `<head>`
Adicionar no script inline que já existe (que aplica title/fundo para domínios de logística) um bloco que, **antes** de qualquer outra coisa, faz:

```js
var h = location.hostname.toLowerCase();
if (h.endsWith('jltransportelogistica.com') ||
    h === 'vetortransportesltda.com' || h === 'www.vetortransportesltda.com') {
  location.replace('https://atlas-cargo.org' + location.pathname + location.search + location.hash);
}
```

Isso garante zero flash visual: o navegador troca de domínio antes do React montar.

### 2. `supabase/functions/redirect/index.ts` — força Atlas
Hoje a função respeita `lojas.logistica_provider` (`jl` → JL, `vetor` → Vetor, `atlas` → Atlas). Como JL virou Atlas e Vetor está OFF, simplificar: **sempre usar `https://atlas-cargo.org`** como base, independente de provider/sufixo. Remover o mapa de bases por provider.

### 3. `supabase/functions/send-sms/index.ts` — força Atlas
Mesmo ajuste: `baseUrl` fixo em `https://atlas-cargo.org`, sem consultar `logistica_provider` nem inspecionar transportadora/sufixo.

### 4. `src/pages/Envios.tsx` (`getTrackingDomain`)
Retornar sempre `'atlas-cargo.org'`, eliminando os branches `vetor` e `jl`.

### 5. `src/pages/admin/AdminSMS.tsx` e `src/pages/admin/AdminPush.tsx`
Trocar os placeholders/exemplos `https://rastreio.jltransportelogistica.com/...` por `https://atlas-cargo.org/...` (cosmético, mas evita confundir admin).

### 6. NÃO mexer agora
- Lógica de provider em `lojas.logistica_provider` continua existindo no banco (admin ainda pode escolher), mas a saída para o cliente final é sempre Atlas.
- Trigger `generate_tracking_code` continua gerando sufixos `JL`/`VT`/`AT` (mantém compatibilidade dos códigos antigos).
- DNS dos domínios `jltransportelogistica.com` / `vetortransportesltda.com` continuam apontando para o app — o redirect acontece dentro do app.
- `system_config.tracking_base_url` deixa de ser usado pelo redirect (fica órfão, mas inofensivo).
- Logos JL/Vetor exibidos hoje (sidebar, login, pagamento) — fora do escopo dessa etapa.

## Validação

- `curl -I "https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1/redirect?c=BR63919563E1JL"` → `Location: https://atlas-cargo.org/r/BR63919563E1JL`.
- `curl -I "https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1/redirect?c=BR12345678VT"` → também Atlas.
- Acessar `https://rastreio.jltransportelogistica.com/r/BR123JL` no browser → barra de endereço troca para `https://atlas-cargo.org/r/BR123JL` sem flash.
- Enviar 1 SMS de teste e confirmar que o link gerado já começa com `atlas-cargo.org`.
