## Problema

Ao salvar preços customizados de um cliente no modal "Preços Customizados", o `UPDATE` em `profiles.custom_prices` é silenciosamente bloqueado pela RLS. As políticas atuais de `profiles` são:

- `Users can update own profile` → `auth.uid() = id`
- (não existe nenhuma política UPDATE para admins)

Como o admin tenta atualizar a linha de **outro** usuário, o `auth.uid() = id` falha, a RLS filtra a linha, o Supabase retorna sucesso com `0 rows affected` e o toast "Preços customizados salvos!" aparece — mas nada muda no banco.

## Correção

Adicionar política RLS de UPDATE para administradores em `public.profiles` via migration:

```sql
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

## Validação

Reabrir o modal de Preços Customizados, definir um valor (ex.: 0.80 em "E-mail de Rastreio"), salvar e reabrir — o valor deve persistir e aparecer pré-preenchido.
