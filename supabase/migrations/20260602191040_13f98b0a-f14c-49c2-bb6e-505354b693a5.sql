
-- Permitir templates de sistema (sem loja)
ALTER TABLE public.postagem_templates ALTER COLUMN loja_id DROP NOT NULL;

-- Política de leitura: qualquer usuário autenticado pode ler templates de sistema
CREATE POLICY "Authenticated read system templates"
ON public.postagem_templates
FOR SELECT
TO authenticated
USING (is_system = true);

-- Service role precisa gerenciar para o sistema de avanço
CREATE POLICY "Service role manage postagem_templates"
ON public.postagem_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role manage postagem_eventos"
ON public.postagem_eventos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
