
# Engenharia de Debito Automatico de Moedas

## Resumo

Implementar a logica que debita moedas automaticamente da conta do usuario toda vez que um envio e processado. O debito acontece **uma unica vez por envio**, no momento em que o **primeiro evento** e disparado (quando o envio sai do status "pendente"). O valor debitado corresponde a soma dos servicos ativos na configuracao da loja.

## Regras de Negocio

- O debito ocorre apenas no **primeiro avanço** de cada envio (quando `ultimo_evento_ordem` era 0)
- O valor debitado e calculado com base nos servicos ativos da loja (NF-e, rastreio, SMS, taxacao)
- Os valores unitarios sao lidos da tabela `system_config`
- Se o usuario nao tiver saldo suficiente, o envio **nao avanca** e retorna erro
- Cada debito gera um registro em `creditos_transacoes` para historico

## Fluxo

```text
triggerNextEmail() chamado
       |
       v
  E o primeiro evento? (ultimo_evento_ordem == 0)
       |
  SIM  |  NAO --> continua sem debitar
       v
  Busca system_config (custos)
       |
       v
  Calcula total com base nos servicos ativos da postagem_config
       |
       v
  Verifica saldo >= total
       |
  SIM  |  NAO --> retorna null + log de saldo insuficiente
       v
  Debita saldo (UPDATE creditos)
       |
       v
  Registra transacao (INSERT creditos_transacoes)
       |
       v
  Continua fluxo normal
```

## Mudancas Tecnicas

### 1. Funcao de banco `debit_user_credits` (migracao)

Funcao SQL `SECURITY DEFINER` que atomicamente:
- Verifica se o saldo e suficiente
- Debita o valor da tabela `creditos`
- Insere registro em `creditos_transacoes` com tipo "consumo"
- Retorna true/false

```text
CREATE OR REPLACE FUNCTION public.debit_user_credits(
  _user_id UUID,
  _quantidade NUMERIC,
  _descricao TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_saldo NUMERIC;
BEGIN
  SELECT saldo INTO current_saldo
  FROM creditos WHERE user_id = _user_id FOR UPDATE;

  IF current_saldo IS NULL OR current_saldo < _quantidade THEN
    RETURN FALSE;
  END IF;

  UPDATE creditos
  SET saldo = saldo - _quantidade, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'consumo', _quantidade, _descricao);

  RETURN TRUE;
END;
$$;
```

### 2. Alterar `src/lib/email-trigger.ts`

Na funcao `triggerNextEmail`, apos identificar o proximo evento e **antes de enviar o email**, se for o primeiro evento (currentOrdem == 0):

1. Buscar o `user_id` da loja (via tabela `lojas`)
2. Buscar os custos da `system_config`
3. Calcular o total baseado nos servicos ativos da `postagem_config`
4. Chamar `supabase.rpc('debit_user_credits', { _user_id, _quantidade, _descricao })` 
5. Se retornar false, abortar o fluxo e retornar null

### 3. Feedback visual (Envios.tsx)

Quando o `triggerNextEmail` falhar por saldo insuficiente, exibir toast de erro informando que o saldo e insuficiente.

## Arquivos alterados/criados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar funcao `debit_user_credits` |
| `src/lib/email-trigger.ts` | Adicionar logica de debito no primeiro evento |
| `src/pages/Envios.tsx` | Tratar erro de saldo insuficiente no toast |
