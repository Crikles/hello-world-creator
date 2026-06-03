## Problemas identificados

1. **A edge function `redirect`** (usada nos links curtos do Resend/SMS — `…supabase.co/functions/v1/redirect?c=…`) só conhece dois caminhos:
   - Se código termina em `VT` → vetortransportesltda.com
   - Senão → lê `system_config.tracking_base_url` (hoje aponta para `rastreio.jltransportelogistica.com`).
   - **Nunca consulta `lojas.logistica_provider`**, então mesmo com a loja setada como `atlas`, o link cai na JL.

2. **`supabase/functions/send-sms/index.ts`** monta o link com a mesma lógica binária (Vetor vs JL). Ignora Atlas.

3. **`src/pages/Envios.tsx` (getTrackingDomain)** usa `rastreio.atlastransportes.com` para Atlas — domínio inexistente. O correto é `atlas-cargo.org`.

4. **`src/pages/Postagens.tsx`** usa `"jl"` como fallback do provider quando a loja não tem valor. O padrão pedido é `atlas`.

5. Confirmado no banco: as 2 lojas existentes já estão com `logistica_provider = 'atlas'`. O bug é puramente de roteamento dos links.

## Mudanças

### A. `supabase/functions/redirect/index.ts` — roteamento por provider da loja
Resolver `loja_id` a partir do envio (via `c=` código ou `p=`/`f=` id) e ler `lojas.logistica_provider`. Mapear:

- `vetor` → `https://vetortransportesltda.com`
- `atlas` → `https://atlas-cargo.org`
- `jl` → `https://rastreio.jltransportelogistica.com`
- sem provider / fallback → `atlas-cargo.org` (novo default seguro, em vez de JL)

Manter o atalho de sufixo `VT` apenas como detecção rápida, mas sempre validar com a loja quando possível. Sufixo `AT` também passa a forçar Atlas.

### B. `supabase/functions/send-sms/index.ts`
Mesma lógica: buscar `loja_id` do envio, ler `logistica_provider`, montar `baseUrl` por provider (atlas/vetor/jl) com mesmo mapa acima e fallback Atlas.

### C. `src/pages/Envios.tsx`
Em `getTrackingDomain`, trocar `'rastreio.atlastransportes.com'` por `'atlas-cargo.org'` para os envios identificados como Atlas (sufixo `AT`).

### D. `src/pages/Postagens.tsx`
Trocar o fallback `return data?.logistica_provider || "jl"` por `"atlas"`. Não muda nenhuma loja existente (todas já são atlas); só corrige o default para futuras lojas / casos `null`.

### E. Não mexer
- `domain-config.ts` (já está correto — Atlas como default no frontend).
- `system_config.tracking_base_url` (continua existindo para retrocompatibilidade, mas redirect só usa quando provider é `jl` ou ausente e código for sufixo JL).
- WhatsApp / Push templates exibidos no admin (placeholders cosméticos) — fora de escopo.

## Resultado

- Email/SMS que hoje gera link `…/functions/v1/redirect?c=BR63919563E1JL` → passa a redirecionar para `https://atlas-cargo.org/r/BR63919563E1JL` (provider da loja = atlas), em vez de cair na JL.
- Atlas vira o padrão real em todos os lugares onde havia fallback `jl`.
- JL continua funcionando para lojas explicitamente marcadas como `jl`; Vetor continua igual.

## Validação

- `curl -I "https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1/redirect?c=BR63919563E1JL"` → deve responder 302 com `Location: https://atlas-cargo.org/r/BR63919563E1JL`.
- Reenviar 1 email/SMS de teste e clicar no link.
- Trocar manualmente `lojas.logistica_provider` de uma loja para `jl` e validar que volta a apontar para JL.
