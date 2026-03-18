

## Plano: Migrar domínio de rastreio para `rastreio.jltransportelogistica.com`

### Resumo
Substituir todas as referências ao domínio antigo `rastreio.logisticajltransportes.com` pelo novo `rastreio.jltransportelogistica.com` em **11 arquivos** (frontend + edge functions). Depois, fazer redeploy de todas as edge functions afetadas.

### Arquivos a alterar (find & replace `logisticajltransportes` → `jltransportelogistica`)

**Frontend (6 arquivos):**
1. `src/lib/domain-config.ts` — domínio base
2. `src/pages/Envios.tsx` — helper `getTrackingDomain`
3. `src/pages/WhatsApp.tsx` — `TRACKING_BASE_URL`
4. `src/pages/Rastreio.tsx` — links de contato no footer (email `contato@`)
5. `src/pages/admin/AdminSMS.tsx` — preview de SMS
6. `src/components/postagens/emailTemplates.ts` — URLs padrão dos templates (~7 ocorrências)

**Edge Functions (4 arquivos):**
7. `supabase/functions/send-sms/index.ts` — `baseUrl`
8. `supabase/functions/send-email/index.ts` — `appBaseUrl` (2 ocorrências)
9. `supabase/functions/advance-shipments/index.ts` — `waBaseUrl`
10. `supabase/functions/send-push-notification/index.ts` — mailto de VAPID

**Nota:** O e-mail de contato em `Rastreio.tsx` (`contato@logisticajltransportes.com`) também será atualizado para `contato@jltransportelogistica.com`.

### Após as edições
- Redeploy das 4 edge functions: `send-sms`, `send-email`, `advance-shipments`, `send-push-notification`
- Mensagens já enviadas (SMS/e-mail antigos) não serão afetadas — apenas novos envios usarão o domínio atualizado

