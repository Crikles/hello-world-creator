

## Painel de Envios - NFE + Código de Rastreio

Um painel administrativo para gerenciar envios, gerar DANFE (NFE visual em PDF) e enviar notificações por email aos clientes com nota fiscal e código de rastreio.

---

### 1. Layout do Painel
- **Sidebar** com navegação: Dashboard, Envios, Empresa, Configurações
- **Header** com nome do usuário/empresa
- Design limpo e moderno inspirado nos prints de referência, com cores em tons de azul

### 2. Dashboard
- Cards de resumo: Total de Pedidos, Pendentes, Em Trânsito, Entregues
- Visão geral rápida dos envios recentes

### 3. Cadastro da Empresa
- Formulário para cadastrar dados fiscais da empresa (Razão Social, CNPJ, Inscrição Estadual, endereço completo)
- Upload de logo da empresa
- Esses dados serão usados automaticamente na geração da DANFE
- Dados salvos no Supabase

### 4. Gestão de Envios
- **Tabela de envios** com: Cliente, Produto, Valor, Código de Rastreio, Status, Progresso
- **Cadastro manual** de novos envios (nome do cliente, email, produto, valor, código de rastreio)
- **Webhook endpoint** (Edge Function) para receber pedidos automaticamente de plataformas de checkout
- Status do envio: Pendente → Em Trânsito → Saiu para Entrega → Entregue
- Busca e filtros na tabela

### 5. Geração de DANFE (PDF Visual)
- Geração de PDF no formato DANFE usando Canvas/jsPDF no navegador
- Campos preenchidos automaticamente com dados da empresa + dados do pedido/cliente
- Pré-visualização da DANFE em modal antes de enviar
- Seções: Emitente, Destinatário, Cálculo do Imposto, Transportador, Produtos/Serviços, Dados Adicionais

### 6. Envio de Email
- Edge Function no Supabase para envio real de emails (usando Resend)
- Emails automáticos em cada mudança de status do pedido:
  - "Atualização do Pedido" (quando cadastrado)
  - "Seu pedido está em trânsito" (com código de rastreio)
  - "Seu pedido saiu para entrega"
  - "Pedido entregue" (com DANFE em anexo PDF)
- Templates de email com dados da empresa (logo, nome)

### 7. Backend (Supabase / Lovable Cloud)
- **Tabelas**: empresas, envios/pedidos
- **Edge Functions**: webhook para receber pedidos, envio de emails
- **Storage**: logo da empresa, PDFs gerados

