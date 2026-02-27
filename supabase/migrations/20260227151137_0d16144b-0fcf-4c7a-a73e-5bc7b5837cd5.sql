
-- Alter creditos.saldo from integer to numeric
ALTER TABLE public.creditos ALTER COLUMN saldo TYPE numeric USING saldo::numeric;
ALTER TABLE public.creditos ALTER COLUMN saldo SET DEFAULT 0;

-- Alter creditos_transacoes.quantidade from integer to numeric
ALTER TABLE public.creditos_transacoes ALTER COLUMN quantidade TYPE numeric USING quantidade::numeric;
