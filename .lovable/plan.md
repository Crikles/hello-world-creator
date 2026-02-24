
# Pre-setar Tempos Realistas nos Fluxos de Email

## Contexto

Os delays atuais nos templates de sistema estao com valores muito baixos (2-4 horas entre eventos), o que nao reflete a realidade logistica brasileira. Vamos atualizar para tempos que fazem sentido para envios via Correios/transportadoras.

## Novos Tempos Propostos

### Nacional Padrao (entrega em 7-12 dias uteis)

| Evento | Delay Atual | Novo Delay | Logica |
|---|---|---|---|
| Nota Fiscal Emitida | 0h (imediato) | 0h (imediato) | Enviado assim que postado |
| Pedido Coletado | 2h (0 dias) | 24h (1 dia) | Coleta no dia seguinte |
| Em Transito | 24h (1 dia) | 48h (2 dias) | Entra na malha em 2 dias |
| Centro de Distribuicao | 48h (2 dias) | 120h (5 dias) | Transporte entre estados |
| Saiu para Entrega | 2h (0 dias) | 24h (1 dia) | Separacao e rota no dia seguinte |
| Entregue | 4h (0 dias) | 0h (mesmo dia) | Entrega no mesmo dia que saiu |

**Total estimado: ~9 dias**

### Nacional Taxacao (entrega em 12-20 dias uteis, com pausa para pagamento)

| Evento | Delay Atual | Novo Delay | Logica |
|---|---|---|---|
| Nota Fiscal Emitida | 0h | 0h | Imediato |
| Pedido Coletado | 2h | 24h (1 dia) | Coleta no dia seguinte |
| Em Transito | 24h | 48h (2 dias) | Entra na malha |
| Centro de Distribuicao | 48h | 120h (5 dias) | Transporte entre estados |
| Aguardando Pagamento | 2h | 24h (1 dia) | Notificacao apos retencao |
| Pagamento Confirmado | 0h | 72h (3 dias) | Tempo para cliente pagar taxa |
| Saiu para Entrega | 2h | 24h (1 dia) | Liberacao e rota |
| Entregue | 4h | 0h (mesmo dia) | Entrega no dia |

**Total estimado: ~13 dias**

### Nacional Expressa (entrega em 2-4 dias uteis)

| Evento | Delay Atual | Novo Delay | Logica |
|---|---|---|---|
| Pedido Confirmado | 0h | 0h | Imediato |
| Em Rota de Entrega | 24h | 48h (2 dias) | Transporte rapido |
| Entregue | 4h | 24h (1 dia) | Entrega no dia seguinte |

**Total estimado: ~3 dias**

## Implementacao

### Migracao SQL

Um UPDATE nos registros da tabela `postagem_eventos` para os templates de sistema (`is_system = true`), atualizando o campo `delay_horas` com os novos valores baseados no `status_label` e `template_id` de cada template.

### Arquivo modificado

Nenhum arquivo de codigo precisa ser alterado - a mudanca e apenas nos dados do banco de dados.
