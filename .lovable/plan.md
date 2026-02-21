

## Redesign Visual: Dashboard + Envios + Novo Envio

Baseado nas imagens de referencia, vou redesenhar completamente a Dashboard e a pagina de Envios para ficarem visuais, animadas e diferenciadas.

---

### 1. Dashboard - Redesign Completo

**Cards coloridos com gradientes e icones** (como na referencia):
- Total de Pedidos: gradiente roxo/violeta com icone de pacote
- Pendentes: gradiente laranja com icone de relogio
- Em Transito: gradiente azul escuro com icone de caminhao
- Entregues: gradiente verde com icone de check

Cada card tera:
- Fundo com gradiente colorido e texto branco
- Icone semi-transparente no canto superior direito
- Animacao de entrada (fade-in escalonado)
- Hover com leve scale

**Secao de Faturamento**:
- Grafico de area/linha usando Recharts (ja instalado) mostrando receita e pedidos ao longo do tempo
- Card lateral com "Canais de Notificacao" (Email ativo, SMS desativado)

**Secao inferior**:
- Card "Ultimas Atualizacoes" com timeline de mudancas de status recentes

**Mensagem de boas-vindas**: "Dashboard - Bem-vindo de volta! Aqui esta o resumo dos seus envios."

---

### 2. Pagina de Envios - Redesign

**Header** com subtitulo descritivo: "Gerencie todos os pedidos enviados e codigos de rastreio."

**Barra de acoes**:
- Toggle "Envio Automatico"
- Botoes "Iniciar Todos Pendentes" e "Avancar Todos"
- Busca e botao "+ Novo Envio" (azul, destaque)

**Tabela aprimorada**:
- Colunas: Cliente (nome + email), Produto, Valor, Codigo, Status (badge colorido), Progresso (barra visual), Acoes (icones)
- Barra de progresso visual baseada no status (pendente=1/4, em_transito=2/4, saiu=3/4, entregue=4/4)
- Icones de acao: ver detalhes, deletar

---

### 3. Modal "Novo Envio" - Wizard Multi-Step

Substituir o dialog simples por um wizard de 3 etapas com indicador de progresso (dots):

**Etapa 1 - Dados do Cliente**:
- Nome*, CPF, Email, Telefone
- Tipo de Envio (Nacional BR)

**Etapa 2 - Endereco de Entrega**:
- CEP*, Endereco*, Numero*, Bairro*
- Cidade*, UF* (select), Complemento

**Etapa 3 - Informacoes do Produto**:
- Nome do Produto*, Quantidade*, Preco (R$)*
- Botao "+ Adicionar Produto"
- Secao "Dados Fiscais (DANFE)" com CFOP, NCM/SH, CST, Unidade, Quantidade
- Botao "Salvar Pedido"

Navegacao com botoes "Voltar" e "Proximo".

---

### 4. Banco de Dados

Sera necessario adicionar colunas na tabela `envios` para os novos campos:
- `cliente_telefone` (text, nullable)
- `cliente_numero` (text, nullable)
- `cliente_bairro` (text, nullable)
- `cliente_complemento` (text, nullable)
- `quantidade` (integer, default 1)
- `cfop` (text, nullable)
- `ncm_sh` (text, nullable)
- `cst` (text, nullable)
- `unidade` (text, default 'UN')

---

### 5. Detalhes Tecnicos

**Arquivos a criar/modificar**:
- `src/pages/Dashboard.tsx` - Redesign completo com cards coloridos, grafico Recharts, canais de notificacao, ultimas atualizacoes
- `src/pages/Envios.tsx` - Redesign com barra de progresso, icones de acao, toggle envio automatico, wizard multi-step
- `src/components/envios/NovoEnvioWizard.tsx` - Componente do wizard de 3 etapas
- Migration SQL para adicionar colunas novas

**Animacoes**:
- Cards com `animate-fade-in` e delay escalonado via style
- Hover scale nos cards
- Transicoes suaves entre etapas do wizard
- Barra de progresso animada na tabela

**Bibliotecas usadas** (ja instaladas):
- `recharts` para o grafico de faturamento
- `lucide-react` para todos os icones
- Componentes shadcn/ui existentes
