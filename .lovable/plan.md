

## Plano: Sistema de Indicação com Comissão de 10%

### Resumo
Cada usuário terá um código de indicação único. Quando alguém se registra via link de indicação e faz uma recarga, o indicador recebe 10% do valor em moedas automaticamente.

### Banco de dados

**1. Nova coluna em `profiles`:**
```sql
ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN referred_by uuid REFERENCES auth.users(id);
```

**2. Trigger para gerar código automático no registro:**
```sql
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();
```

**3. Atualizar profiles existentes** (via insert tool):
```sql
UPDATE public.profiles SET referral_code = upper(substr(md5(id::text || now()::text), 1, 8)) WHERE referral_code IS NULL;
```

**4. Tabela de histórico de indicações:**
```sql
CREATE TABLE public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  pix_payment_id uuid NOT NULL,
  amount_earned numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral earnings" ON public.referral_earnings
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
```

### Frontend

**1. Signup (`src/pages/Signup.tsx`)**
- Ler query param `?ref=CODIGO` da URL
- Salvar no `localStorage` antes do signup
- Passar `referral_code` no `user_metadata` do `signUp`

**2. `handle_new_user` trigger (atualizar)**
- Buscar `referral_code` do `raw_user_meta_data`
- Encontrar o `referrer` pelo código e setar `referred_by` no novo perfil

**3. Webhook BlackCat (`supabase/functions/webhook-blackcat/index.ts`)**
- Após creditar moedas ao comprador, verificar se `user.referred_by` existe
- Se sim, calcular 10% do valor em moedas e creditar ao indicador
- Registrar na tabela `referral_earnings`

**4. Nova página `src/pages/Indicacao.tsx`**
- Card principal com link de indicação copiável (`{origin}/signup?ref={code}`)
- Estatísticas: total de indicados, total de moedas ganhas
- Histórico de ganhos com data e valor
- Visual atraente com ícones e badges

**5. Sidebar (`src/components/layout/AppSidebar.tsx`)**
- Adicionar item "Indicação" com ícone `Users` entre Moedas e Empresa

**6. Rotas (`src/App.tsx`)**
- Adicionar rota `indicacao` dentro do layout da loja

### Arquivos alterados
- **Migração SQL**: colunas em `profiles`, tabela `referral_earnings`, trigger
- **`src/pages/Signup.tsx`**: capturar `?ref=` param
- **`supabase/functions/webhook-blackcat/index.ts`**: comissão de 10%
- **`src/pages/Indicacao.tsx`**: nova página
- **`src/components/layout/AppSidebar.tsx`**: novo menu item
- **`src/App.tsx`**: nova rota
- **Trigger `handle_new_user`**: associar `referred_by`

