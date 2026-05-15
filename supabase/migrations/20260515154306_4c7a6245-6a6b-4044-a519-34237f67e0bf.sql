CREATE OR REPLACE FUNCTION public.sync_envios_on_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.template_ativo_id IS DISTINCT FROM OLD.template_ativo_id
     AND NEW.template_ativo_id IS NOT NULL THEN
    UPDATE public.envios
    SET postagem_template_id = NEW.template_ativo_id
    WHERE loja_id = NEW.loja_id
      AND deleted_at IS NULL
      AND status <> 'entregue'
      AND (
        postagem_template_id IS DISTINCT FROM NEW.template_ativo_id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_envios_on_template_change ON public.postagem_config;

CREATE TRIGGER trg_sync_envios_on_template_change
AFTER UPDATE OF template_ativo_id ON public.postagem_config
FOR EACH ROW
EXECUTE FUNCTION public.sync_envios_on_template_change();