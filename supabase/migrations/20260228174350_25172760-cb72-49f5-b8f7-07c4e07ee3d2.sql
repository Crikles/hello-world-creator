
CREATE TABLE public.push_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  url text,
  icon_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access push_templates"
ON public.push_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
