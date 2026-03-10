

# Revisão do Fluxo JADLOG e Correção do E-mail Remetente

## Status Atual

O código já está quase completo para a integração JADLOG. Após revisão detalhada:

- **Configurações** (`Configuracoes.tsx`): Seletor de logística JL/JADLOG funcionando, salva na coluna `logistica_provider`.
- **Geração de código de rastreio** (`NovoEnvioWizard.tsx`): Gera `BR...JD` e transportadora "JADLOG Logística" quando provider é `jadlog`.
- **Rastreio** (`Rastreio.tsx`): Detecta JADLOG por domínio (`centrojadlog.com`) ou sufixo do código (`JD`). Alterna logo, cores e branding.
- **Pagamento** (`Pagamento.tsx`): Detecta JADLOG pela transportadora do envio. Alterna logo e cores.
- **E-mail** (`send-email/index.ts`): Usa `noreply@centrojadlog.com`, cor vermelha e URLs do domínio JADLOG.

## Bug Encontrado

Na Edge Function `send-email` (linha 854-856), o `email_remetente` da `postagem_config` do usuário **sobrescreve** o e-mail JADLOG. Se o lojista tem `noreply@jltransportes.pro` configurado, envios JADLOG também usam esse remetente.

**Correção:** Para envios JADLOG, forçar `noreply@centrojadlog.com` independente da configuração do usuário.

## Alteração

### `supabase/functions/send-email/index.ts` (linhas 854-856)

Antes:
```typescript
if (config?.email_remetente) {
  emailRemetente = config.email_remetente;
}
```

Depois:
```typescript
if (config?.email_remetente && !isJadlog) {
  emailRemetente = config.email_remetente;
}
```

Isso garante que envios JADLOG sempre usem `noreply@centrojadlog.com`, enquanto envios JL continuam respeitando a configuração personalizada do lojista.

Após a correção, será feito o redeploy da Edge Function `send-email`.

