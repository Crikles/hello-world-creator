## Problema

A cobrança por pedido está incorreta. O esperado é **1,50 moedas** quando NF-E (0,50) + Email Rastreio (1,00) estão ativos, mas o sistema está debitando **2,00 moedas** (arredondado para cima).

**Causa raiz:** as colunas `creditos.saldo` e `creditos_transacoes.quantidade` são do tipo `INTEGER`. A função `debit_user_credits` recebe `numeric` (1.5), mas:
- O `UPDATE` do saldo subtrai 1.5 de um campo integer → Postgres arredonda para 2.
- O `INSERT` na transação faz cast explícito `_quantidade::integer` → também vira 2.

Resultado: cada envio cobra 2 moedas em vez de 1,50. Verifiquei no banco — todas as transações recentes "Envio processado (NF-e, E-mail)" estão registradas com `quantidade=2`.

A lógica de quando cobrar já está correta:
- O débito acontece em `advance-shipments` no primeiro avanço (currentOrdem === 0), ou seja, quando a NF-E inicia o fluxo.
- O total soma todos os serviços ativos da loja (NF-E + Email + Taxação + Falha).
- SMS é cobrado separadamente por etapa (mantido como está).

## Plano

### 1. Migration: suportar valores fracionados em moedas

- Alterar `public.creditos.saldo` de `INTEGER` para `NUMERIC(10,2)`.
- Alterar `public.creditos_transacoes.quantidade` de `INTEGER` para `NUMERIC(10,2)`.
- Reescrever `debit_user_credits` removendo o cast `::integer` no insert.
- Garantir que `add_user_credits` / fluxos de adição (admin, PIX, etc.) também usem `numeric` — verificar e ajustar se existirem outras funções/inserts diretos.

### 2. Backend / Edge Functions

- Conferir todos os `supabase.rpc("debit_user_credits", ...)` e `INSERT INTO creditos_transacoes` em `advance-shipments`, `send-sms`, `send-email`, `send-recovery-email`, `send-payment-confirmation`, `create-pix-payment`, `admin-manage-user`, `cron-check-pending-pix`, `webhook-*`, `low-balance-alert`, `api-external` — garantir que enviam o valor decimal corretamente (a maioria já lê `costMap` do `system_config` que é numeric, então provavelmente só precisa do schema corrigido).

### 3. Frontend

- Verificar componentes que exibem saldo / histórico (Dashboard, Moedas, header da loja com "46,00 moedas") para garantir que renderizam decimais com 2 casas (`toFixed(2)` ou formatação BRL).
- Confirmar que filtros / somatórios em relatórios suportam `numeric`.

### 4. Validação

- Após migration, criar um envio de teste com NF-E + Email ativos e validar que:
  - Saldo cai exatamente 1,50.
  - Transação aparece como `quantidade = 1.50` em `creditos_transacoes`.
  - SMS continua sendo cobrado 0,20 por etapa de forma independente.

## Detalhes técnicos

```sql
ALTER TABLE public.creditos
  ALTER COLUMN saldo TYPE NUMERIC(10,2) USING saldo::numeric;

ALTER TABLE public.creditos_transacoes
  ALTER COLUMN quantidade TYPE NUMERIC(10,2) USING quantidade::numeric;

CREATE OR REPLACE FUNCTION public.debit_user_credits(
  _user_id uuid, _quantidade numeric, _descricao text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_saldo numeric;
BEGIN
  SELECT saldo INTO current_saldo FROM creditos WHERE user_id = _user_id FOR UPDATE;
  IF current_saldo IS NULL OR current_saldo < _quantidade THEN RETURN FALSE; END IF;
  UPDATE creditos SET saldo = saldo - _quantidade, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'consumo', _quantidade, _descricao);
  RETURN TRUE;
END $$;
```

**Observação:** transações antigas registradas com `quantidade=2` ficarão como estão (histórico). O ajuste vale apenas para novos débitos. Se quiser, posso também adicionar um script de estorno para devolver a diferença (0,50 por envio cobrado a mais hoje) aos usuários afetados — me avise.