## Diagnóstico

Investiguei o `adm.depositovisual@gmail.com` e cruzei com **todas as contas**.

### Conta `adm.depositovisual@gmail.com`
- Lojas **Hidraulica jupira** e **Deposito** estão com config OK (`enviar_nfe_email=true`, template Nacional Padrão).
- Template tem o evento NF-e na ordem 1 corretamente configurado.
- Mas há **6 envios "fantasmas"** (4 em Hidraulica jupira + 2 em Deposito): o sistema marcou `ultimo_evento_ordem = 1` ("Nota Fiscal Emitida"), mas **nenhum log de e-mail foi criado** — ou seja, a NF-e simplesmente **nunca saiu**.

### Causa raiz (bug no cron `advance-shipments`)
Nos logs vejo dezenas de erros assim:
```
ERROR Email failed for envio xxx: FunctionsFetchError
  context: RateLimitError: Rate limit exceeded ... Retry after 40s
INFO Advanced envio xxx -> Em Trânsito
```

A ordem das operações no cron está errada:
1. Debita os créditos do usuário ✅
2. Atualiza `ultimo_evento_ordem` no envio ✅ (envio passa a constar como "Nota Fiscal Emitida")
3. Invoca `send-email` ❌ — quando o **rate limit do Supabase Functions** bate, falha
4. Apenas faz `console.error` — **não estorna, não retenta, não reverte o avanço**

Resultado: cliente nunca recebe a NF-e, o lojista pagou pelo serviço, e o painel mostra a etapa como concluída.

### Impacto em outras contas (envios fantasma últimos 30 dias)
| Loja | Usuário | Envios sem e-mail |
|---|---|---|
| Prime | negociosmilionarios1901@gmail.com | 126 |
| Variedades | backupativado@gmail.com | 44 |
| Ferra | andretelees@hotmail.com | 35 |
| 1 | ajufrfh98@outlook.com | 30 |
| Vercaro | vercarosuporte@gmail.com | 20 |
| yaveh | rodrigosantosderesendejunior@gmail.com | 11 |
| Hidraulica jupira | adm.depositovisual@gmail.com | 4 |
| Deposito | adm.depositovisual@gmail.com | 2 |
| **Total** | | **272** |

### Caso à parte (não é bug)
- `andretelees@hotmail.com` (saldo R$ 0,00) e `48f079b8...` têm dezenas de envios travados por **saldo insuficiente** — o sistema já trata isso corretamente (não debita, não avança, gera WARN). Eles precisam recarregar.

---

## Plano de correção

### 1. Corrigir o bug no `advance-shipments` (raiz)
Reordenar e tornar atômica a relação avanço × envio de e-mail:

- Detectar `funcErr` no `send-email` invoke.
- Se houver erro **e** o evento exigia e-mail/NF-e:
  - **Reverter** `ultimo_evento_ordem` para o valor anterior (`currentOrdem`)
  - **Estornar** o débito feito via `refund_user_credits`
  - Limpar `proximo_avanco_em` para o próximo cron tentar de novo

Assim, no próximo ciclo (5 min depois) o cron tentará novamente, e o lojista nunca paga por NF-e que não foi enviada.

### 2. Backfill imediato dos 272 envios afetados
Invocar a edge function `backfill-missed-emails` com janela de 30 dias para reenviar a NF-e/e-mail dos envios fantasma já detectados. Isso recupera os clientes finais que não receberam a NF-e.

### 3. Verificação pós-correção
- Rodar query que conta envios fantasma e confirmar que zerou (ou caiu drasticamente).
- Monitorar logs do `advance-shipments` por 24h para garantir que os retries do rate-limit estão funcionando.

---

## Detalhes técnicos

**Arquivo a editar:** `supabase/functions/advance-shipments/index.ts` (linhas 970–985)

**Mudança no fluxo de envio de e-mail:**
```ts
if (isAtivo && nextEvent.enviar_email) {
  const { error: funcErr } = await supabase.functions.invoke("send-email", { ... });
  if (funcErr) {
    console.error(`Email failed (will revert) for envio ${envioId}:`, funcErr);
    // Reverter avanço
    await supabase.from("envios").update({
      ultimo_evento_ordem: currentOrdem,
      status: previousStatus,
      status_label: previousStatusLabel,
      proximo_avanco_em: null,
    }).eq("id", envioId);
    // Estornar débito
    if (debitedTotal > 0) {
      await supabase.rpc("refund_user_credits", {
        _user_id: lojaUserId,
        _quantidade: debitedTotal,
        _descricao: `Estorno: falha ao enviar e-mail envio ${envioId}`,
      });
    }
    return false;
  }
}
```

**Backfill via supabase.functions.invoke:**
```ts
supabase.functions.invoke("backfill-missed-emails", {
  body: { hours: 720, dry_run: false, limit: 500, concurrency: 5 }
});
```
(Janela de 30 dias = 720h. Concurrency baixa para não esbarrar de novo no rate limit.)

**Sem mudanças de schema.** Apenas patch da edge function + invocação única de backfill.
