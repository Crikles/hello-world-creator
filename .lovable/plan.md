## Diagnóstico

Revisei o caminho do clique em **Baixar NF-e** e o que ele de fato executa hoje:

- `handleDownloadNfe` abre o `AlertDialog` (`setNfeConfirm(envio)`).
- Ao confirmar, `executeDownloadNfe` chama **apenas** a edge function `download-nfe`.
- A edge function `download-nfe` faz só duas coisas: `debit_user_credits` e `UPDATE envios SET nfe_cobrado = true`. Não chama `email-trigger`, `advance-shipments`, `send-email`, nem nenhuma RPC que avance o envio.
- Triggers da tabela `envios`: `aa_apply_global_flow_on_envio` (BEFORE INSERT), `trigger_generate_tracking_code` (BEFORE INSERT), `update_envios_updated_at` (BEFORE UPDATE, só timestamp) e `envios_to_leads_trg` (sincroniza tabela `leads`). Nenhuma inicia fluxo de e-mail.

Ou seja, o clique em "Baixar NF-e" **não tem caminho de código** que dispare o fluxo. O que provavelmente ocorreu: o cron `advance-shipments` rodou no mesmo instante (executa a cada minuto e auto-inicia pendentes quando `postagem_config.auto_envio = true`), dando a impressão de ter sido o clique.

Os logs recentes de `advance-shipments` confirmam que ele está processando pendentes a cada minuto.

## Plano de correção (defensivo e verificável)

### 1. Blindar `download-nfe` contra qualquer efeito de fluxo
Adicionar comentário e um `console.log` explícito ("download-nfe NÃO avança o envio") logo após o débito, para auditoria futura nos logs. Garante que qualquer regressão futura fique rastreável.

### 2. Garantir que o botão "Baixar" do diálogo não cause side-effects de UI
Trocar `AlertDialogAction` por um `Button` comum com `type="button"` dentro do `AlertDialogFooter`, e fechar o diálogo manualmente. Isso elimina qualquer possibilidade do Radix re-disparar a tecla Enter no botão original (a NF-e), e impede submit acidental caso alguém embrulhe a página num `<form>` no futuro.

### 3. Validar `auto_envio` da loja afetada
Conferir se `postagem_config.auto_envio = true` na loja em questão. Se estiver, o cron seguirá iniciando pendentes mesmo sem clique. Caso o usuário **não** queira esse comportamento automático, a solução real é desativar o toggle "Auto-envio" na aba Envios.

### 4. Verificar comportamento real
- Olhar os logs de `download-nfe` após o próximo clique do usuário (com o `console.log` novo) para confirmar que **só** o débito é executado.
- Comparar com os timestamps de `advance-shipments` para validar a hipótese de coincidência com o cron.

## Pergunta antes de implementar

Você quer que eu **bloqueie o auto-início pelo cron** quando o usuário só baixa a NF-e (sem nunca clicar em Iniciar)? Hoje, se `auto_envio` estiver ativo, o cron começa o fluxo sozinho — independentemente do download. Posso:

- (a) Manter como está: `auto_envio` controla tudo, download não influencia.
- (b) Adicionar regra: cron só auto-inicia se `auto_envio = true` **e** o envio ainda não teve NF-e baixada manualmente (`nfe_cobrado = false`), para que o download manual "congele" o envio até você clicar em Iniciar.

Me confirme a opção (a) ou (b) — e se quiser que eu já desative o `auto_envio` da sua loja agora.
