
# Pagina de Integracoes com Checkouts

## O que sera feito

Criar uma nova pagina dedicada a **Integracoes**, separada da pagina de Configuracoes, onde cada checkout tera seu proprio card com:
- Logo do checkout (placeholder por enquanto)
- Nome do checkout
- URL do webhook unica para copiar
- Status de conexao (ativo/inativo)
- Botao para ativar/desativar

### Checkouts incluidos:
1. Vega Checkout
2. Zedy Checkout
3. Luna Checkout
4. Corvex Checkout

## Proporcao ideal das imagens de logo

Para ficar visualmente bonito e consistente, a proporcao ideal para os logos dos checkouts e:

- **Tamanho recomendado**: 120x120px ou 160x40px (se for logo horizontal)
- **Formato**: PNG com fundo transparente
- **Proporcao**: 1:1 (quadrado) para icones, ou 4:1 (retangular) para logos horizontais
- **Resolucao**: 2x (240x240px ou 320x80px) para telas retina

**Recomendacao**: Envie todas no mesmo formato (todas quadradas OU todas horizontais) para manter a consistencia visual.

## Estrutura das mudancas

### 1. Nova pagina: `src/pages/Integracoes.tsx`
- Layout usando AppLayout com titulo "Integracoes"
- Grid de cards, um para cada checkout
- Cada card tera:
  - Area de logo (placeholder com icone ate receber as imagens)
  - Nome do checkout
  - Descricao curta
  - URL do webhook gerada (com botao de copiar)
  - Badge de status (Ativo/Inativo)
  - Switch para ativar/desativar

### 2. Atualizacao do sidebar: `src/components/layout/AppSidebar.tsx`
- Adicionar item "Integracoes" no menu com icone `Plug` do lucide-react
- Posicionar entre "Empresa" e "Configuracoes"

### 3. Atualizacao do roteamento: `src/App.tsx`
- Adicionar rota `/integracoes` apontando para a nova pagina

### 4. Atualizacao da pagina de Configuracoes: `src/pages/Configuracoes.tsx`
- Remover o card de Webhook (ja que agora fica na pagina de Integracoes)
- Manter apenas o card de Email

## Detalhes tecnicos

- Os webhooks terao URLs no formato: `https://{project-url}/functions/v1/webhook-{checkout}` (placeholder por enquanto)
- O botao de copiar usara `navigator.clipboard.writeText()` com feedback via toast
- Nenhuma tabela no banco sera criada neste momento -- isso sera feito quando a documentacao dos checkouts for fornecida
- Os logos usarao um placeholder com a primeira letra do nome do checkout ate as imagens serem enviadas
