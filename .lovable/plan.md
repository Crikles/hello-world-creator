

## Plano: Unificar domínio para jltransportes e diferenciar JADLOG pelo código de rastreio

### Contexto
O domínio `rastreio.centrojadlog.com` caiu. Toda a operação passa a rodar em `rastreio.logisticajltransportes.com`. A diferenciação visual (branding JADLOG vs JL) será feita exclusivamente pelo código de rastreio (sufixo "JD") ou campo `transportadora`.

### Alterações

**1. `src/lib/domain-config.ts`**
- Remover `rastreio.centrojadlog.com` da lista de domínios logísticos
- Remover `isJadlogDomain()` (não será mais usado)

**2. `src/pages/Rastreio.tsx`**
- Remover importação de `isJadlogDomain`
- `isJadlog` passa a depender apenas do código de rastreio buscado (sufixo "JD") ou do campo `transportadora` do envio retornado
- Atualizar email de contato no footer JADLOG (remover `contato@centrojadlog.com`, usar alternativa ou omitir)

**3. `src/pages/Envios.tsx`**
- `getTrackingDomain` sempre retorna `rastreio.logisticajltransportes.com` (domínio único)

**4. `supabase/functions/send-email/index.ts`**
- Substituir `noreply@centrojadlog.com` por `noreply@jltransportes.pro` (remetente único)
- `appBaseUrl` sempre `https://rastreio.logisticajltransportes.com`

**5. `supabase/functions/send-sms/index.ts`**
- `baseUrl` sempre `https://rastreio.logisticajltransportes.com`

**6. `supabase/functions/advance-shipments/index.ts`**
- `waBaseUrl` sempre `https://rastreio.logisticajltransportes.com`

**7. `src/App.tsx`**
- Remover referência a `isJadlogDomain` no título (JADLOG será detectado pela rota/código, não pelo domínio)

### O que NÃO muda
- O design/layout JADLOG no Rastreio.tsx permanece intacto (ativado pelo código de rastreio "JD")
- As cores vermelhas da JADLOG continuam funcionando
- Toda a lógica de branding por `transportadora` ou sufixo do código permanece

