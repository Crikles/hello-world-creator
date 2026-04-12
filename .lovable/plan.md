

## Plano: Criar Template Prolongado

### Contexto
O sistema possui 3 templates de sistema (IDs `...0001`, `...0002`, `...0004`). Preciso criar um 4o template "Prolongado" com muitos eventos intermediários para prolongar o rastreio, similar ao print onde há ~12 atualizações antes da entrega.

### Eventos do Template Prolongado (~15 eventos)
Baseado no screenshot, o template terá eventos que "enrolam" com múltiplas atualizações de movimento:

| Ordem | Status Label | Nome | Delay (horas) |
|-------|-------------|------|---------------|
| 1 | Postado | Pedido separado | 0 |
| 2 | Coletado | Coletado pela Transportadora | 24 |
| 3 | Em Trânsito | Objeto em transferência | 48 |
| 4 | Em Trânsito | Em trânsito para unidade de tratamento | 48 |
| 5 | Em Trânsito | Em trânsito para unidade de tratamento estadual | 72 |
| 6 | Em Trânsito | Seu pacote está em movimento | 48 |
| 7 | Em Trânsito | Seu pacote está em movimento | 120 |
| 8 | Em Trânsito | Seu pacote está em movimento | 120 |
| 9 | Em Trânsito | Seu pacote está em movimento | 120 |
| 10 | Em Trânsito | Seu pacote está em movimento | 72 |
| 11 | Centro Local | Seu pacote está próximo | 48 |
| 12 | Centro Local | Seu pacote está próximo | 48 |
| 13 | Saiu para Entrega | Saiu para entrega | 24 |
| 14 | Entregue | Pedido entregue | 240 |

### Implementação

#### 1. Migration SQL
Criar o template de sistema com ID fixo `00000000-0000-0000-0000-000000000005` e tipo `prolongado`, com todos os 14 eventos na tabela `postagem_eventos`. Cada evento terá `enviar_email: true`, `assunto_email` e `corpo_email` padrão. O evento de NF-e será incluído como ordem 1.

#### 2. Atualizar `Postagens.tsx`
- Adicionar o ID `...0005` à query de `systemEventos` (linha 180-184)
- Pronto — o restante do código já renderiza templates de sistema dinamicamente

#### 3. Atualizar `AdminTemplates.tsx`
Nenhuma alteração necessária — já carrega todos os templates de sistema.

#### 4. Atualizar `emailTemplates.ts`
Adicionar entradas no `defaultSectionsByEvent` e `emojiMap` para novos status labels caso necessário (os existentes já cobrem "Em Trânsito", "Centro Local", etc.).

#### 5. SMS Templates
Criar registros na tabela `sms_templates` para os status do template prolongado que ainda não existam (a maioria já existe pois reutiliza os mesmos `status_key`).

#### 6. Atualizar `rastreio-info` (Edge Function)
Nenhuma alteração necessária — já suporta múltiplos eventos do mesmo status_label.

### Resumo
- 1 migration SQL (template + ~14 eventos + SMS templates novos se necessário)
- 1 edit em `Postagens.tsx` (adicionar ID na query)
- Tudo pronto para o usuário selecionar e usar imediatamente

