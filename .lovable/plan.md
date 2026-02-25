

# Auto-Gerar Codigo de Rastreio e Integrar com Emails

## Resumo

Toda vez que um envio for criado (manual ou via webhook), o sistema vai gerar automaticamente um codigo de rastreio unico. Os emails enviados ao cliente terao o botao "Rastrear Pedido" apontando para o site de logistica (`logisticajltransportes.com`) com o codigo de rastreio no URL.

## O que muda

### 1. Trigger no banco de dados para gerar codigo de rastreio automaticamente

Criar uma funcao e trigger no PostgreSQL que, ao inserir um envio sem `codigo_rastreio`, gera automaticamente um codigo no formato `BRXXXXXXXXXX` (prefixo BR + 10 caracteres alfanumericos aleatorios).

Isso cobre TODOS os cenarios:
- Envio manual (NovoEnvioWizard)
- Webhooks (Corvex, Luna, Vega, Zedy)
- Importacao via planilha

### 2. Atualizar o email (send-email edge function)

Mudar o botao "Rastrear Pedido" nos emails para apontar para:
```
https://logisticajltransportes.com/r/{codigo_rastreio}
```

Em vez do link atual para os Correios (`https://rastreamento.correios.com.br/app/index.php`).

Isso vale para todos os status exceto "Entregue" (que ja nao mostra botao) e "Taxacao" (que aponta para pagamento).

### 3. Atualizar templates de email do frontend (emailTemplates.ts)

Substituir as URLs `https://rastreamento.correios.com.br/app/index.php` nos templates padrao pela URL do dominio de logistica com o codigo de rastreio.

---

## Detalhes Tecnicos

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_tracking_code
  BEFORE INSERT ON public.envios
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tracking_code();
```

### send-email/index.ts

- Trocar `urlBotaoCta` de `https://rastreamento.correios.com.br/...` para `https://logisticajltransportes.com/r/${rastreio}`
- O codigo de rastreio ja esta disponivel no objeto `envio`

### emailTemplates.ts

- Trocar todas as `url_botao_cta` de correios para `https://logisticajltransportes.com/r/{{codigo_rastreio}}`

### Arquivos afetados

| Arquivo | Tipo de mudanca |
|---|---|
| Migration SQL | Novo trigger para auto-gerar codigo |
| `supabase/functions/send-email/index.ts` | URL do botao CTA |
| `src/components/postagens/emailTemplates.ts` | URLs dos templates padrao |

