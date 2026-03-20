

## Plano: Monitor de Saúde do Sistema no Admin Dashboard

### O que será criado

Uma nova seção **"Saúde do Sistema"** no AdminDashboard, abaixo dos emails, com dados em tempo real consultados diretamente do banco via queries SQL (usando `.rpc()` ou queries diretas).

### Métricas exibidas

**1. Banco de Dados (grid 4 colunas)**
- Tamanho total do banco (soma de todas as tabelas)
- Total de registros (soma de rows)
- Maior tabela (nome + tamanho)
- Tabelas com mais crescimento (top por row count)

**2. Fila de Processamento (grid 3 colunas)**
- Envios aguardando avanço (`proximo_avanco_em <= now() AND status != pausados`)
- Emails pendentes hoje (`status = 'pending'`)
- Webhooks das últimas 24h (total + falhas)

**3. Edge Functions (grid 3 colunas)**
- Tempo médio de resposta (últimas 24h, via analytics)
- Taxa de erro (% de status != 200)
- Total de chamadas hoje

**4. Tabela de Tabelas** 
- Lista das 10 maiores tabelas com nome, rows e tamanho
- Barras de progresso visuais proporcionais

### Como buscar os dados

- **DB stats**: Query `pg_stat_user_tables` + `pg_total_relation_size` via uma database function (RPC) pois o client não acessa `pg_stat_*` diretamente. Alternativa: contar rows das tabelas conhecidas diretamente.
- **Fila de processamento**: Queries normais nas tabelas `envios`, `postagem_email_log`, `webhook_logs`
- **Edge Functions**: Não acessível do frontend. Usaremos os dados já disponíveis (`webhook_logs` para taxa de erro, `postagem_email_log` para volume)

### Implementação prática (sem RPC)

Como não temos acesso a `pg_stat_*` do frontend, usaremos queries diretas:

**Arquivo: `src/pages/admin/AdminDashboard.tsx`**
- Adicionar nova query `admin-system-health` que busca:
  - `envios` com `proximo_avanco_em <= now()` e status ativo → fila de avanço
  - `postagem_email_log` com `status = 'pending'` hoje → emails pendentes  
  - `webhook_logs` últimas 24h → total e falhas
  - Contagem de cada tabela principal (envios, pedidos, email_log, webhook_logs, leads)
- Nova seção visual com ícone de Activity/Server
- Cards com indicadores de status (verde/amarelo/vermelho baseado em thresholds)
- Refresh automático a cada 30s (mesmo interval dos emails)

### Thresholds visuais
- **Fila de avanço**: Verde (<50), Amarelo (50-200), Vermelho (>200)
- **Emails pendentes**: Verde (<20), Amarelo (20-100), Vermelho (>100)
- **Taxa erro webhook**: Verde (<5%), Amarelo (5-15%), Vermelho (>15%)

