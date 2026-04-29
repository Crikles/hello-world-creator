# Painel de Uso da Cloud no Admin Dashboard

Hoje o admin só tem o botão "Limpar Banco". Vamos criar uma seção completa **"Uso da Cloud"** que mostra de forma clara e didática quanto o projeto está consumindo, onde está o gargalo, e o que pode ser limpo — tudo dentro de `/admin`.

## O que será exibido

### 1. Cards de resumo (topo)
- **Tamanho total do banco** (ex: `592 MB`) com barra visual e indicador de tendência
- **Total de registros** (soma das principais tabelas)
- **Última limpeza executada** (data + quanto liberou)
- **Status da instância** (verde/amarelo/vermelho baseado em uso)

### 2. Top tabelas (gráfico de barras)
Lista as 15 maiores tabelas com:
- Nome amigável (ex: "Pedidos" em vez de `pedidos`)
- Tamanho em MB e % do total
- Quantidade de registros
- Idade do registro mais antigo
- Indicador "🟢 Saudável / 🟡 Atenção / 🔴 Limpar"

Exemplo do que apareceria hoje:
```
Pedidos              309 MB  (52%)  [🔴 Limpar payloads antigos]
Webhook Logs          81 MB  (14%)  [🟡 Pode reduzir]
Fila WhatsApp         36 MB  ( 6%)  [🟢 OK]
Logs de E-mail        34 MB  ( 6%)  [🟢 OK]
Envios                17 MB  ( 3%)  [🟢 OK]
```

### 3. Edge Functions (últimas 24h)
- Total de invocações
- Taxa de erro (%) — com alerta se > 5%
- Top 5 funções mais chamadas
- Top 5 funções mais lentas (tempo médio)

### 4. Ações de limpeza (com explicação)
Em vez de um botão único e cego, **3 botões separados** com texto claro:

- **"Limpar payloads antigos de pedidos"** — Remove o JSON bruto de pedidos com mais de 30 dias. *Não afeta dados do cliente, apenas o registro original do checkout.* (~150 MB)
- **"Limpar logs de webhooks processados"** — Esvazia payload de webhooks já processados há mais de 30 dias. (~40 MB)
- **"Limpar fila WhatsApp finalizada"** — Apaga mensagens já enviadas/falhas/canceladas há mais de 15 dias. (~20 MB)
- **"Limpeza completa"** — Executa as 3 acima + logs internos de cron/http.

Cada botão mostra um **modal de confirmação** explicando exatamente o que será apagado, e ao final um toast com "X MB liberados".

### 5. Histórico de limpezas
Tabela simples com últimas 10 execuções: data, quem rodou, registros afetados, espaço liberado.

### 6. Recomendações inteligentes
Bloco com dicas dinâmicas baseadas nos números, ex:
- ⚠️ "Tabela `pedidos` está com 309 MB — recomendamos limpar payloads antigos"
- ⚠️ "Banco passou de 80% da capacidade recomendada — considere upgrade da instância"
- ✅ "Última limpeza foi há 2 dias — tudo em dia"

---

## Detalhes técnicos

**Nova RPC `get_cloud_usage_stats()`** (SECURITY DEFINER, restrita a admin):
Retorna em um único JSON:
- `db_size_bytes` via `pg_database_size(current_database())`
- `tables[]` via `pg_stat_user_tables` + `pg_total_relation_size` (top 15)
- `row_counts` para tabelas principais
- `oldest_record` por tabela (created_at min)

**Nova RPC `cleanup_pedidos_payloads()`, `cleanup_webhook_logs()`, `cleanup_whatsapp_queue()`** — versões separadas e granulares da `cleanup_old_data` atual, cada uma retornando `{ rows_affected, bytes_freed_estimate }`.

**Nova tabela `cleanup_history`**:
```
id, executed_by, action, rows_affected, bytes_freed, executed_at
```
Populada automaticamente pelas RPCs.

**Edge function logs**: consulta a função `analytics_query` interna do Supabase via service role para puxar contagens de `function_edge_logs` das últimas 24h. Como isso requer chamada autenticada, criar edge function `admin-cloud-stats` que retorna esses números.

**Frontend (`src/pages/admin/AdminDashboard.tsx`)**:
- Nova seção `<CloudUsagePanel />` em componente separado `src/components/admin/CloudUsagePanel.tsx`
- Usa `react-query` com refetch a cada 60s
- Gráfico de barras com Recharts (já no projeto)
- Modais de confirmação com `AlertDialog` do shadcn
- Botão "Limpar Banco" atual é removido (substituído pelas ações granulares)

**Segurança**: todas as RPCs e edge functions checam `has_role(auth.uid(), 'admin')` no início. Mobile bloqueado conforme regra existente do admin.

---

## Limitações honestas
- Tamanho exato do **storage de arquivos** (buckets `logos`, `nfe-pdfs`, `pix-qrcodes`) não é exposto via SQL — vamos mostrar apenas contagem de objetos por bucket, com link "Ver detalhes na Cloud" para o painel oficial.
- Métricas de **CPU/RAM da instância** não são acessíveis via API pública do Supabase — vamos exibir um aviso "Para CPU/RAM, ver painel da Lovable Cloud" com link.
- Custos em R$/USD não são calculáveis (depende do plano) — mostramos só consumo bruto.
