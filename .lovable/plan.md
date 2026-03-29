

## Auditoria de Segurança — Vulnerabilidades Encontradas

Realizei uma análise completa do código frontend, edge functions, RLS policies e fluxos de autenticação. Abaixo estão as falhas encontradas, organizadas por severidade.

---

### CRÍTICO — Impersonação via SessionStorage (Escalação de Privilégio)

**Arquivo:** `src/contexts/AuthContext.tsx`

O sistema de "loginAs" armazena um usuário falso no `sessionStorage` e o retorna como `user` no contexto de autenticação. **Qualquer pessoa** pode abrir o DevTools do navegador e executar:

```javascript
sessionStorage.setItem("impersonated_user", JSON.stringify({
  id: "ID-DE-QUALQUER-USUARIO",
  email: "vitima@gmail.com",
  user_metadata: { full_name: "Admin" },
  is_impersonated: true
}));
```

Depois basta recarregar a página — o sistema vai carregar o usuário falso e mostrar dados do outro usuário. Como as queries do Supabase usam o `session` real (não o impersonado), **os dados exibidos na tela dependem da RLS**. Porém, qualquer funcionalidade que use `user.id` do contexto (ex: criar PIX para outro usuário em `Moedas.tsx` linha 134) pode causar problemas.

**Correção:** Mover a lógica de impersonação para o servidor. O admin deve chamar uma edge function que valide que é admin e retorne os dados do usuário-alvo. Nunca confiar em sessionStorage para identidade.

---

### ALTO — useIsAdmin consulta user_roles com user impersonado

**Arquivo:** `src/hooks/useIsAdmin.ts`

O hook usa `user.id` do contexto Auth — que pode ser o ID impersonado. Se alguém manipular o sessionStorage com o ID de um admin real, o `useIsAdmin` vai retornar `true` e dar acesso ao painel admin. A RLS protege parcialmente (a query roda com o JWT real do Supabase), mas **a rota `/admin/*` ficará acessível visualmente** porque o `AdminRoute` checa `isAdmin` que agora é `true`.

**Correção:** O `useIsAdmin` deve sempre usar `realUser` (o usuário autenticado real), nunca o potencialmente impersonado.

---

### ALTO — Edge Functions sem validação JWT

Várias edge functions com `verify_jwt = false` no `config.toml` **não validam o JWT internamente**:

- `send-verification-sms` — Qualquer um pode disparar SMS/WhatsApp de verificação passando qualquer telefone. O rate limit de 3/10min é bom, mas não há autenticação.
- `verify-sms-code` — Público, permite brute-force do código de 6 dígitos (1M combinações). Sem rate limit de tentativas de verificação.
- `advance-shipments` — Se não valida JWT, qualquer pessoa pode avançar envios.
- `save-push-subscription` — Público, permite spam de subscriptions.

**Correção:** Adicionar rate limiting por IP no `verify-sms-code` (máx 5 tentativas por telefone/10min). Adicionar autenticação nas edge functions que operam dados sensíveis.

---

### ALTO — Brute-force do código SMS

**Arquivo:** `supabase/functions/verify-sms-code/index.ts`

Não há rate limit nas tentativas de verificação do código. Um atacante pode tentar todas as 1.000.000 combinações de 6 dígitos. O rate limit existente é apenas no **envio** do SMS (3/10min), não na **verificação**.

**Correção:** Adicionar contador de tentativas na tabela `signup_verifications`. Após 5 tentativas erradas, invalidar o código.

---

### MÉDIO — Webhook Woovi sem assinatura

**Arquivo:** `supabase/functions/webhook-woovi/index.ts`

O webhook verifica o status via API OpenPix (bom), mas **qualquer pessoa pode enviar um POST** com um `correlationID` válido. A verificação via API mitiga falsificação, mas se a API OpenPix estiver indisponível, o código prossegue sem verificação (linhas 104-106 apenas logam erro).

**Correção:** Se a verificação via API falhar, rejeitar o webhook ao invés de continuar.

---

### MÉDIO — Rastreio expõe dados pessoais

**Arquivo:** `supabase/functions/rastreio-info/index.ts`

O endpoint público retorna `cliente_nome`, `cliente_cidade`, `cliente_estado` sem autenticação. Qualquer pessoa com um código de rastreio pode ver o nome e localização do cliente.

**Correção:** Considerar mascarar o nome (ex: "J*** S***") no endpoint público.

---

### MÉDIO — listUsers() escalabilidade

**Arquivo:** `supabase/functions/send-verification-sms/index.ts` (linha 56)

`supabase.auth.admin.listUsers()` carrega **todos os usuários** para verificar se um email existe. Conforme a base cresce, isso ficará lento e pode falhar. Além disso, não pagina — por padrão retorna apenas 50 usuários, então emails duplicados podem passar.

**Correção:** Usar `supabase.from("profiles").select("id").eq("email", email).maybeSingle()` ao invés de listar todos.

---

### BAIXO — CORS permissivo

Todas as edge functions usam `Access-Control-Allow-Origin: *`. Isso permite que qualquer site faça requisições às suas APIs.

**Correção:** Restringir para os domínios permitidos (`magnusfrete.lovable.app`, `jltransportelogistica.com`, etc).

---

### BAIXO — Redirect sem sanitização

**Arquivo:** `supabase/functions/redirect/index.ts`

O parâmetro `c` é inserido diretamente na URL de redirecionamento. Embora o `code` vá para um path, não é sanitizado contra caracteres especiais.

---

## Plano de Correção (Priorizado)

### Fase 1 — Crítico (Imediato)
1. **Corrigir impersonação**: Fazer `useIsAdmin` usar `realUser` ao invés de `user`. Adicionar validação no `AdminRoute` para usar `realUser`.
2. **Rate limit no verify-sms-code**: Adicionar contador de tentativas erradas (máx 5), bloquear código após exceder.

### Fase 2 — Alto
3. **Webhook Woovi**: Rejeitar pagamento se verificação API falhar (ao invés de continuar).
4. **listUsers → query profiles**: Trocar `listUsers()` por query na tabela `profiles`.

### Fase 3 — Médio
5. **Mascarar nome no rastreio público**.
6. **CORS restritivo** nas edge functions mais sensíveis.

### Arquivos alterados
- `src/hooks/useIsAdmin.ts`
- `src/components/AdminRoute.tsx`
- `supabase/functions/verify-sms-code/index.ts`
- `supabase/functions/webhook-woovi/index.ts`
- `supabase/functions/send-verification-sms/index.ts`

