# Plano: corrigir findings de segurança

## 1. Bucket `pix-qrcodes` (Error) — restringir leitura pública

**Contexto:** o bucket é privado mas existe a política `Public read pix-qrcodes` que libera leitura para qualquer um. O QR code é enviado dentro do email de recuperação (`send-recovery-email`) usando URL pública direta.

**Solução:** trocar para URLs assinadas (signed URLs com validade longa, ex.: 30 dias) e remover a política pública.

- Migration: `DROP POLICY "Public read pix-qrcodes" ON storage.objects` — manter apenas a política do `service_role`.
- Editar `supabase/functions/send-recovery-email/index.ts` e `supabase/functions/webhook-vega/index.ts`: substituir a construção manual da URL pública por `supabase.storage.from('pix-qrcodes').createSignedUrl(path, 60*60*24*30)`.

## 2. `postagem_eventos` com `loja_id IS NULL` (Warning)

**Contexto:** a política `Users own loja postagem_eventos` permite ALL quando `loja_id IS NULL`, deixando qualquer usuário autenticado alterar/deletar eventos de sistema.

**Solução:** migration que recria a política removendo o branch NULL no `WITH CHECK`. Leitura de templates de sistema continua, mas escritas em linhas com `loja_id IS NULL` ficam restritas ao `service_role` / admin.

```sql
DROP POLICY "Users own loja postagem_eventos" ON public.postagem_eventos;

CREATE POLICY "Users read system or own postagem_eventos"
  ON public.postagem_eventos FOR SELECT
  USING (loja_id IS NULL OR user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Users write own postagem_eventos"
  ON public.postagem_eventos FOR INSERT
  WITH CHECK (loja_id IS NOT NULL AND user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Users update own postagem_eventos"
  ON public.postagem_eventos FOR UPDATE
  USING (loja_id IS NOT NULL AND user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (loja_id IS NOT NULL AND user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Users delete own postagem_eventos"
  ON public.postagem_eventos FOR DELETE
  USING (loja_id IS NOT NULL AND user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Admins manage all postagem_eventos"
  ON public.postagem_eventos FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

## 3. Tabela `leads` (Warning) — PII exposta + insert anônimo

**Contexto:** `leads` é preenchida pelo trigger `envio_to_lead` (security definer) e por `admin-manage-user`. A policy `Anyone insert leads` permite qualquer um (até anon) inserir. Donos de loja não têm SELECT.

**Solução:**

```sql
DROP POLICY "Anyone insert leads" ON public.leads;

-- Sem grant para anon
REVOKE INSERT ON public.leads FROM anon;

CREATE POLICY "Users view own loja leads"
  ON public.leads FOR SELECT
  USING (user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Service role manage leads"
  ON public.leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

Inserts continuam funcionando via trigger `SECURITY DEFINER` e via `admin-manage-user` (que usa service role).

## 4. Extensão `pg_net` em `public` (Warning)

**Solução:** mover para o schema `extensions`:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
```

Se algum código chama `net.http_post(...)` de forma qualificada, ajustar para `extensions.http_post(...)` — vou verificar nas migrations/funções após aprovação.

## Ordem de execução

1. Migration única consolidando #2, #3 e #4.
2. Migration separada para #1 (DROP policy) + edição das 2 edge functions para gerar signed URLs.
3. Rodar scan novamente para confirmar.

## Observações

- Nenhuma quebra funcional esperada: o QR PIX continuará carregando nos emails via signed URL; donos de loja ganham leitura de leads (hoje só admin lê); eventos de sistema continuam visíveis para todos, mas só admins/service role escrevem.
