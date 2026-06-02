# Plano: Secrets, Resend de Rastreio e Remoção de Gateways

## 1. Cadastrar os 9 secrets no Lovable Cloud

Usar o tool `add_secret` (modal seguro) para os nomes abaixo. O usuário cola os valores no formulário — não passamos valores por código:

- `INTEGRAX_API_KEY`
- `RESEND_API_KEY`
- `RESEND_RECOVERY_API_KEY`
- `RESEND_CONFIRMATION_API_KEY`
- `RESEND_TRACKING_API_KEY`
- `UAZAPI_ADMIN_TOKEN`
- `CYBERPAY_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Observação: como os valores já foram colados em texto no chat, eles ficaram expostos no histórico — recomendo rotacionar essas chaves após o cadastro. Posso continuar com os valores enviados se preferir.

## 2. Ajustar a function de email de rastreio

Arquivo: `supabase/functions/send-email/index.ts` (esta é a function de rastreio — confirmado pela presença de `codigo_rastreio`, `trackingBlock`, templates de rastreio).

Mudança (linhas 1066-1068):

```ts
const RESEND_API_KEY =
  Deno.env.get("RESEND_TRACKING_API_KEY") ||
  Deno.env.get("RESEND_API_KEY"); // fallback
if (!RESEND_API_KEY) {
  throw new Error("RESEND_TRACKING_API_KEY is not configured");
}
```

Mantém fallback para não quebrar caso a secret não esteja setada.

## 3. Remover gateways BlackCat e Woovi

### Edge Functions
- Deletar `supabase/functions/webhook-blackcat/` (via `delete_edge_functions`)
- Deletar `supabase/functions/webhook-woovi/` (via `delete_edge_functions`)

### Frontend
Rodar `rg -i "blackcat|woovi|openpix"` em `src/` — busca inicial não retornou nada, então provavelmente não há referências no frontend. Confirmar e remover se houver.

### Banco de dados
Verificar tabelas de configuração de gateway:
- Buscar registros em `gateway_config` / `checkout_integrations` / `postagem_config` com provider `blackcat`, `woovi` ou `openpix`
- Criar migration de cleanup se existirem (somente DELETE de linhas, não DROP de coluna — não sabemos se outros providers usam o mesmo enum/tabela)

## Ordem de execução
1. `add_secret` com os 9 nomes (usuário cola valores)
2. Editar `send-email/index.ts`
3. `delete_edge_functions` para blackcat e woovi
4. Buscar e limpar referências no frontend/DB
5. Deploy automático das functions alteradas
