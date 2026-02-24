

# Postagens - Sistema de Fluxos de Email por Evento de Rastreamento

## Resumo

Criar uma nova aba "Postagens" no painel para gerenciar fluxos de email automaticos por tipo de postagem (Nacional Padrao, Nacional Taxacao, Nacional Expressa). Cada fluxo possui eventos de rastreamento configuraveis que disparam emails ao cliente, com opcao de anexar PDF da Nota Fiscal. Cada email enviado custa R$ 0,15 (debitado dos creditos do usuario).

---

## Fluxos de Postagem

### Nacional Padrao (6 eventos)
1. Nota Fiscal Emitida (status: postado)
2. Pedido Coletado (status: coletado)
3. Em Transito (status: em_transito)
4. Centro de Distribuicao (status: centro_local)
5. Saiu para Entrega (status: saiu_para_entrega)
6. Entregue (status: entregue)

### Nacional com Taxacao (8 eventos)
1. Nota Fiscal Emitida
2. Pedido Coletado
3. Em Transito
4. Centro de Distribuicao
5. Aguardando Pagamento (taxacao)
6. Pagamento Confirmado
7. Saiu para Entrega
8. Entregue

### Nacional Expressa (3 eventos)
1. Pedido Confirmado (coletado)
2. Em Rota de Entrega (saiu_para_entrega)
3. Entregue

---

## Banco de Dados

### Tabela `postagem_templates`
Armazena os templates pre-configurados e templates salvos pelo usuario.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | ID |
| loja_id | uuid FK (nullable) | null = template padrao do sistema |
| nome | text | Nome do template |
| descricao | text | Descricao |
| tipo | text | `padrao`, `taxacao`, `expressa`, `custom` |
| is_system | boolean | true = template padrao imutavel |
| created_at | timestamptz | |

### Tabela `postagem_eventos`
Eventos de cada template, com ordem, delay e configuracao de email.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | ID |
| template_id | uuid FK | Template pai |
| nome | text | Nome do evento (ex: "Nota Fiscal Emitida") |
| descricao | text | Descricao do evento |
| status_label | text | Label do badge (ex: "Postado", "Em Transito") |
| ordem | integer | Ordem de exibicao |
| delay_horas | integer | Delay em horas apos evento anterior (default 0) |
| enviar_email | boolean | Se deve enviar email neste evento |
| enviar_nfe_pdf | boolean | Se deve anexar PDF da NFe no email |
| assunto_email | text | Assunto do email |
| corpo_email | text | Corpo HTML do email (template com variaveis) |
| is_final | boolean | Se e o evento final do fluxo |
| created_at | timestamptz | |

### Tabela `postagem_config`
Configuracao ativa de postagem por loja.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | ID |
| loja_id | uuid FK | Loja |
| template_ativo_id | uuid FK | Template ativo |
| enviar_emails | boolean | Toggle global de envio de emails |
| enviar_nfe_email | boolean | Toggle global de enviar NFe no email de NF Emitida |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Tabela `postagem_email_log`
Log de emails enviados para controle e cobranca.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | ID |
| loja_id | uuid FK | Loja |
| envio_id | uuid FK | Envio relacionado |
| evento_id | uuid FK | Evento que disparou |
| destinatario | text | Email do cliente |
| assunto | text | Assunto enviado |
| status | text | sent, failed, pending |
| custo | numeric | 0.15 |
| created_at | timestamptz | |

### Alteracao na enum `shipment_status`
Adicionar novos status para suportar os fluxos:
- `coletado`
- `centro_local`
- `taxacao`
- `pagamento_confirmado`

### RLS Policies
- Todas as tabelas terao RLS habilitado
- Templates do sistema (is_system = true) serao leitura para todos
- Templates customizados e configs filtrados por `user_owns_loja(auth.uid(), loja_id)`
- Email logs filtrados da mesma forma

---

## Frontend

### 1. Nova pagina `src/pages/Postagens.tsx`

Layout baseado no print de referencia com:

**Secao superior - Templates Pre-configurados**
- Cards para cada template (Nacional Padrao, Nacional Taxacao, Expressa)
- Cada card mostra nome, descricao e badges dos eventos
- Clicar em um template aplica-o como template ativo da loja
- Aviso: "Aplicar um template substituira todos os eventos atuais"

**Secao inferior - Eventos do template ativo**
- Lista ordenada dos eventos do template ativo
- Cada evento mostra: icone, nome, badge de status, descricao
- Botoes de editar (abre dialog) e remover por evento
- Drag handle (icone 6 pontos) para reordenar (visual apenas, sem drag real por ora)
- Botao "+ Adicionar" para criar evento customizado

**Dialog de edicao de evento**
- Nome do evento
- Descricao
- Label do status (badge)
- Delay em horas apos evento anterior
- Toggle: Enviar email neste evento
- Toggle: Anexar PDF da NFe (so visivel no evento "Nota Fiscal Emitida")
- Campo: Assunto do email
- Campo: Corpo do email (textarea com variaveis disponiveis)

**Footer**
- Custo por Envio: mostra total estimado baseado nos eventos com email ativo
- Preco: R$ 0,15 x quantidade de eventos com email

**Configuracoes gerais**
- Toggle global: Enviar emails (liga/desliga todo o sistema de emails)
- Toggle: Enviar NFe no email de Nota Fiscal Emitida

### 2. Atualizar Sidebar
- Adicionar item "Postagens" com icone `Mail` entre "Envios" e "Empresa"

### 3. Atualizar Rotas
- Adicionar rota `postagens` no `LojaRoutes`

---

## Edge Function: `send-tracking-email`

Edge function que sera chamada quando um envio muda de status:

1. Recebe `envio_id` e `novo_status`
2. Busca a config de postagem da loja
3. Busca o evento correspondente ao status no template ativo
4. Se `enviar_email` esta ativo no evento:
   - Busca dados do envio e da empresa
   - Se `enviar_nfe_pdf` esta ativo, gera o HTML da DANFE, converte para PDF usando a mesma logica do frontend (via HTML template)
   - Envia email via Resend com o PDF em anexo (se aplicavel)
   - Debita R$ 0,15 dos creditos do usuario
   - Registra no `postagem_email_log`

### Resend API Key
- Sera necessario configurar o secret `RESEND_API_KEY` para envio de emails
- O usuario precisara fornecer a chave da API do Resend

---

## Fluxo Completo

```text
Webhook recebido (checkout) 
  -> Cria pedido + envio (status: pendente)
  -> Usuario avanca status do envio na aba Envios
  -> Sistema verifica postagem_config da loja
  -> Se evento tem email ativo:
     -> Gera email (com ou sem PDF da NFe)
     -> Envia via Resend
     -> Debita 0.15 creditos
     -> Registra no email_log
```

---

## Sequencia de Implementacao

1. **Migracoes de banco**: Criar tabelas + seed dos templates padrao + alterar enum
2. **Secret do Resend**: Solicitar a API key do Resend ao usuario
3. **Pagina Postagens.tsx**: Interface completa com templates, eventos e configuracao
4. **Sidebar + Rotas**: Adicionar navegacao
5. **Edge function send-tracking-email**: Logica de envio com Resend + debito de creditos
6. **Integracao com Envios**: Ao mudar status de um envio, chamar a edge function

---

## Detalhes Tecnicos

- Variaveis disponiveis nos templates de email: `{{cliente_nome}}`, `{{produto}}`, `{{codigo_rastreio}}`, `{{empresa_nome}}`, `{{status}}`
- O PDF da NFe sera gerado server-side na edge function usando o mesmo HTML template do `DanfePreview`, renderizado como HTML e convertido para PDF
- Custo por email: 0.15 creditos (debitados de `creditos.saldo` e registrados em `creditos_transacoes`)
- Os templates do sistema serao inseridos via migration seed e nao poderao ser editados pelo usuario (apenas copiados)

