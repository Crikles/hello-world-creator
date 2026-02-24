

# Editor de Email Personalizado por Evento de Postagem

## Resumo

Transformar a edicao de email de cada evento de postagem em uma experiencia sofisticada e visual. Em vez de um simples textarea com HTML, criar um editor rico com preview ao vivo, templates de email bonitos, emojis nos assuntos, e uma interface intuitiva para o usuario montar o email perfeito para cada etapa do rastreio.

## O que muda

### 1. Novo componente: EmailEditor

Um componente dedicado que substitui o dialog atual de edicao. Ele sera aberto em um Dialog grande (full-width) com duas colunas:

- **Coluna esquerda**: Formulario de edicao com campos inteligentes
- **Coluna direita**: Preview ao vivo do email renderizado

### 2. Campos do editor

**Assunto do Email:**
- Input com sugestoes de emojis por tipo de evento (ex: "Pedido entregue! check_verde", "Seu pedido esta em transito caminhao")
- Badges clicaveis para inserir variaveis ({{cliente_nome}}, {{produto}}, {{codigo_rastreio}}, etc)
- Preview do assunto como apareceria na caixa de entrada (como no screenshot)

**Corpo do Email:**
- Editor visual com blocos de conteudo:
  - Saudacao personalizada
  - Mensagem principal com area de texto rico
  - Bloco de informacoes do pedido (tabela com produto, codigo rastreio, etc)
  - Bloco de CTA (botao de rastreamento)
  - Rodape com dados da empresa
- Cada bloco pode ser habilitado/desabilitado via toggle
- As variaveis sao inseridas via botoes/chips clicaveis

### 3. Templates de email pre-definidos por evento

Cada tipo de evento tera um template HTML bonito e responsivo pre-configurado:

- **Postado**: "Ola {{cliente_nome}}, seu pedido {{produto}} foi postado! Codigo de rastreio: {{codigo_rastreio}}"
- **Em Transito**: "Seu pedido esta a caminho! Acompanhe pelo codigo {{codigo_rastreio}}"
- **Saiu para Entrega**: "Boas noticias! Seu pedido esta saindo para entrega hoje"
- **Entregue**: "Pedido entregue! Esperamos que voce goste do seu {{produto}}"
- **Taxacao**: (sera personalizado posteriormente, placeholder por enquanto)

Os templates usam um layout HTML inline-styled (compativel com email clients) com:
- Logo da empresa (se disponivel)
- Cores primarias configuráveis
- Layout responsivo para mobile
- Fonte limpa e moderna

### 4. Preview ao vivo

A coluna direita mostra o email renderizado em tempo real:
- Simula a aparencia de uma caixa de entrada (como o screenshot: remetente, assunto, preview)
- Abaixo, mostra o corpo do email renderizado em um iframe/container
- Substitui variaveis por dados de exemplo ("Tiago Elias", "Camiseta Polo", "BR547454312HF")

### 5. Secao de variaveis disponiveis

Um painel com chips/badges clicaveis para cada variavel:
- {{cliente_nome}} - Nome do cliente
- {{cliente_email}} - Email do cliente
- {{produto}} - Nome do produto
- {{codigo_rastreio}} - Codigo de rastreio
- {{transportadora}} - Transportadora
- {{valor}} - Valor do pedido
- {{quantidade}} - Quantidade

Ao clicar, a variavel e inserida na posicao do cursor (tanto no assunto quanto no corpo).

## Detalhes Tecnicos

### Arquivos

- `src/components/postagens/EmailEditor.tsx` -- novo componente principal do editor
- `src/components/postagens/EmailPreview.tsx` -- componente de preview do email
- `src/components/postagens/emailTemplates.ts` -- templates HTML para cada tipo de evento
- `src/pages/Postagens.tsx` -- substituir o dialog de edicao atual pelo novo editor

### Estrutura do EmailEditor

```text
+---------------------------------------------------+
|  Editar Email: "Pedido Entregue"                   |
+------------------------+--------------------------+
| EDICAO                 | PREVIEW                  |
|                        |                          |
| [Assunto]              | From: Loja X             |
| Pedido entregue! [V]   | Sub: Pedido entregue! V  |
|                        | Preview text...          |
| [Variaveis]            |                          |
| {{nome}} {{produto}}   | +----------------------+ |
| {{rastreio}} ...       | |  [Logo]              | |
|                        | |  Ola Tiago,          | |
| [Saudacao]             | |  Seu pedido foi...   | |
| Ola {{cliente_nome}},  | |                      | |
|                        | |  Produto: Camiseta   | |
| [Mensagem]             | |  Rastreio: BR547...  | |
| Seu pedido foi ...     | |                      | |
|                        | |  [Rastrear Pedido]   | |
| [x] Mostrar info       | |                      | |
| [x] Mostrar botao CTA  | |  Att, Loja X         | |
| [ ] Anexar NFe          | +----------------------+ |
+------------------------+--------------------------+
|              [Cancelar]  [Salvar]                  |
+---------------------------------------------------+
```

### Template HTML base

Cada template sera um HTML inline-styled responsivo. O corpo do email sera construido por secoes:

```typescript
interface EmailSections {
  saudacao: string;        // "Ola {{cliente_nome}},"
  mensagem: string;        // mensagem principal
  mostrar_info_pedido: boolean;  // tabela com produto, rastreio, etc
  mostrar_botao_cta: boolean;    // botao "Rastrear Pedido"
  texto_botao_cta: string;       // "Rastrear Pedido"
  url_botao_cta: string;         // link do rastreio
  rodape: string;                // "Atenciosamente, {{empresa_nome}}"
}
```

Esses campos serao armazenados no `corpo_email` como HTML gerado. O editor monta o HTML a partir das secoes e salva o HTML final no campo existente.

### Preview com dados de exemplo

```typescript
const dadosExemplo = {
  cliente_nome: "Tiago Elias Manoel Bernardes",
  cliente_email: "tiago@email.com",
  produto: "Camiseta Polo Premium",
  codigo_rastreio: "BR547454312HF",
  transportadora: "Correios",
  valor: "89,90",
  quantidade: "1",
  empresa_nome: "Minha Loja",
};
```

### Emojis sugeridos por evento

```typescript
const emojiSugeridos: Record<string, string[]> = {
  "Postado": ["📦", "✨", "🎉"],
  "Em Transito": ["🚛", "📍", "🛣️"],
  "Saiu para Entrega": ["🚚", "🏠", "📬"],
  "Entregue": ["✅", "🎁", "💚"],
  "Taxacao": ["⚠️", "📋", "💰"],
};
```

### Nenhuma migracao SQL necessaria

Os campos `assunto_email` e `corpo_email` da tabela `postagem_eventos` ja existem e sao suficientes. O editor gera HTML e salva nesses mesmos campos.

