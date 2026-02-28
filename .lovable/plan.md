

# Automacao Server-Side: Delays + Sistema Funcionando com Computador Desligado

## Problema Central

Atualmente, **todo o processamento de envios acontece no navegador do usuario**. Se o computador estiver desligado ou o navegador fechado, nada acontece:
- Os delays (dias) configurados no fluxo nao sao respeitados automaticamente
- O AUTO so funciona enquanto a aba esta aberta
- Nenhum envio avanca sozinho

## Solucao

Criar uma **Edge Function cron** (funcao backend) que roda automaticamente a cada 5 minutos, 24h por dia, independente do computador do usuario. Essa funcao:

1. **Auto-inicia** novos pedidos (equivalente ao botao AUTO)
2. **Avanca** envios cujo delay ja expirou (respeita os dias configurados)
3. Funciona mesmo com o computador desligado

## Alteracoes

### 1. Nova Edge Function: `advance-shipments`

Funcao backend que roda via cron a cada 5 minutos:

```text
Para cada loja que tem postagem configurada:
  1. Busca envios pendentes (ultimo_evento_ordem = 0, status = pendente)
     -> Se a loja tem AUTO ativado, inicia automaticamente
  2. Busca envios em andamento (status != entregue, proximo_avanco_em <= now())
     -> Avanca para o proximo evento
  3. Respeita 100% os delays configurados (delay_horas)
  4. Processa 1 envio por vez com intervalo para nao sobrecarregar
```

A logica de avanco (debitar creditos, enviar email, enviar SMS) sera replicada do `email-trigger.ts` diretamente na Edge Function, usando o Supabase service role key para operar sem depender de sessao de usuario.

### 2. Coluna `auto_envio` na tabela `postagem_config`

Adicionar uma coluna booleana para persistir o estado do AUTO no banco de dados (atualmente so existe no state do React e se perde ao fechar a pagina):

```sql
ALTER TABLE postagem_config ADD COLUMN auto_envio boolean DEFAULT false;
```

### 3. Cron Job via pg_cron + pg_net

Habilitar as extensoes `pg_cron` e `pg_net` e criar um job que chama a Edge Function a cada 5 minutos:

```text
Cada 5 minutos -> HTTP POST -> advance-shipments
  -> Busca todas as lojas com postagem configurada
  -> Para cada loja, processa envios elegiveis
```

### 4. Atualizar `src/pages/Envios.tsx`

- O switch AUTO agora salva/le do banco de dados (`postagem_config.auto_envio`)
- Quando o usuario ativa o AUTO, ele persiste mesmo com o computador desligado
- Os botoes INICIAR PENDENTES e AVANCAR TODOS continuam funcionando como acoes manuais imediatas

### 5. Corrigir `proximo_avanco_em` nos envios existentes

Os envios existentes tem `proximo_avanco_em = null` mesmo estando em andamento. A Edge Function tratara `null` como "pode avancar agora" para compatibilidade retroativa.

## Como vai funcionar na pratica

```text
Usuario configura o fluxo:
  Evento 1: Nota Fiscal (0 dias)
  Evento 2: Coletado (1 dia)
  Evento 3: Em Transito (2 dias)
  Evento 4: Centro Local (5 dias)
  Evento 5: Saiu para Entrega (1 dia)
  Evento 6: Entregue (0 dias)

Dia 0: Pedido chega via webhook -> AUTO inicia (Evento 1)
        proximo_avanco_em = agora + 24h
Dia 1: Cron detecta delay expirou -> Avanca (Evento 2)
        proximo_avanco_em = agora + 48h
Dia 3: Cron detecta delay expirou -> Avanca (Evento 3)
        proximo_avanco_em = agora + 120h
Dia 8: Cron detecta delay expirou -> Avanca (Evento 4)
        ...e assim por diante
```

Tudo isso acontece **sem o computador ligado**.

## Detalhes Tecnicos

### Edge Function `advance-shipments`

- Usa `SUPABASE_SERVICE_ROLE_KEY` para operar sem autenticacao de usuario
- Processa lojas sequencialmente para evitar sobrecarga
- Limite de 50 envios por execucao (a cada 5 min processa mais)
- Logs detalhados para debug
- Reutiliza a logica de debito de creditos, envio de email e SMS
- Nao gera DANFE/PDF (isso requer DOM do navegador, sera pulado no cron -- a NF-e so e gerada quando o usuario dispara manualmente ou via webhook)

### Cron Job

```text
Frequencia: */5 * * * * (a cada 5 minutos)
Metodo: HTTP POST via pg_net
Endpoint: /functions/v1/advance-shipments
```

### Arquivos modificados

1. `supabase/functions/advance-shipments/index.ts` -- Nova Edge Function (cron)
2. `src/pages/Envios.tsx` -- AUTO salva no banco, nao apenas no state
3. Migracao SQL -- Coluna `auto_envio` + cron job + extensoes

