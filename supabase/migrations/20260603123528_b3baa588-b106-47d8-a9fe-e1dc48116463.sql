
-- 1) postagem_eventos
DROP POLICY IF EXISTS "Users own loja postagem_eventos" ON public.postagem_eventos;

CREATE POLICY "Users read system or own postagem_eventos"
  ON public.postagem_eventos FOR SELECT
  USING (loja_id IS NULL OR public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Users insert own postagem_eventos"
  ON public.postagem_eventos FOR INSERT
  WITH CHECK (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Users update own postagem_eventos"
  ON public.postagem_eventos FOR UPDATE
  USING (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Users delete own postagem_eventos"
  ON public.postagem_eventos FOR DELETE
  USING (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Admins manage all postagem_eventos"
  ON public.postagem_eventos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) leads
DROP POLICY IF EXISTS "Anyone insert leads" ON public.leads;
REVOKE INSERT ON public.leads FROM anon;

CREATE POLICY "Users view own loja leads"
  ON public.leads FOR SELECT
  USING (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Service role manage leads"
  ON public.leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3) Recriar pg_net no schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4) Storage: remover leitura pública do bucket pix-qrcodes
DROP POLICY IF EXISTS "Public read pix-qrcodes" ON storage.objects;
