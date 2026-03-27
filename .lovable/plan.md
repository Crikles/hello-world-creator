

## Plan: Funcionalidade de Upsell nos E-mails

### Conceito
Adicionar uma seção opcional de Upsell nos e-mails de **Nota Fiscal (Postado)** e **Pedido Coletado**, permitindo ao lojista promover um produto adicional com visual totalmente customizável. Cobrança de **0,10 moedas** por e-mail que inclui upsell.

### Estrutura de Dados

**Nova tabela `upsell_config`**:
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| loja_id | uuid | FK para lojas |
| tipo | text | `nfe` ou `coletado` |
| ativo | boolean | Toggle on/off |
| headline | text | Título principal |
| sub_headline | text | Subtítulo |
| produto_nome | text | Nome do produto |
| produto_descricao | text | Descrição curta |
| produto_valor | text | Ex: "R$ 49,90" |
| produto_imagem_url | text | URL da imagem |
| botao_texto | text | Ex: "Comprar Agora" |
| botao_url | text | Link de destino |
| cor_headline | text | Cor do título |
| cor_sub_headline | text | Cor do subtítulo |
| cor_nome_produto | text | Cor do nome |
| cor_descricao | text | Cor da descrição |
| cor_valor | text | Cor do valor |
| cor_botao_bg | text | Background do botão |
| cor_botao_texto | text | Cor do texto do botão |
| cor_fundo | text | Background da seção |

- RLS: `user_owns_loja(auth.uid(), loja_id)`
- 2 registros por loja (um para `nfe`, outro para `coletado`), cada um independente

**system_config**: Adicionar chave `custo_upsell_email` com valor `0.10`

### Frontend

**1. Nova página `src/pages/Upsell.tsx`**
- Nova aba "Upsell" no menu lateral em Operações (entre Postagens e Taxação)
- Duas seções separadas com cards: "Upsell na Nota Fiscal" e "Upsell no Pedido Coletado"
- Cada seção tem:
  - Toggle ativar/desativar
  - Campos de texto: headline, sub_headline, produto_nome, produto_descricao, produto_valor, botao_texto, botao_url
  - Upload/URL da imagem do produto
  - Color pickers para cada cor (headline, sub_headline, nome, descrição, valor, botão bg, botão texto, fundo da seção)
  - Preview em tempo real do bloco de upsell como ficaria no email

**2. Rota e sidebar**
- `App.tsx`: Adicionar rota `/loja/:lojaId/upsell`
- `AppSidebar.tsx`: Adicionar item "Upsell" em Operações com ícone `Sparkles` ou `TrendingUp`

### Backend (Edge Function `send-email/index.ts`)

**3. Lógica de inserção do bloco de upsell no email**
- Na função `buildEmailHtml`, após o bloco do WhatsApp vendedor:
  - Buscar `upsell_config` da loja onde `ativo = true` e `tipo` corresponde ao evento (`nfe` para Postado/NF-e, `coletado` para Coletado)
  - Se encontrado, renderizar bloco HTML com card do produto usando as cores configuradas
  - O bloco fica entre o CTA principal e o rodapé

**4. Cobrança de 0,10 moedas**
- Na lógica de envio do email em `send-email`, quando o upsell está ativo e foi incluído:
  - Chamar `debit_user_credits` com 0,10 (ou `custo_upsell_email` da system_config)
  - Descrição: "Upsell no e-mail - {status_label}"
  - Se saldo insuficiente, envia o email sem o upsell (não bloqueia o envio principal)

### Visual do bloco de Upsell no email
```text
┌─────────────────────────────────┐
│  [Cor de fundo da seção]        │
│                                 │
│  HEADLINE (cor customizada)     │
│  Sub Headline (cor customizada) │
│                                 │
│  ┌──────────┐                   │
│  │  IMAGEM  │  Nome do Produto  │
│  │          │  Descrição         │
│  └──────────┘  R$ 49,90         │
│                                 │
│  [  BOTÃO CTA  ] (cores custom) │
│                                 │
└─────────────────────────────────┘
```

### O que não muda
- Fluxo de envio de emails existente (apenas adiciona bloco opcional)
- Templates de postagem, taxação, falha na entrega
- Lógica de WhatsApp, rastreio, advance-shipments
- Outros custos de moedas

### Resumo de alterações
1. **Migração SQL**: Criar tabela `upsell_config` + inserir `custo_upsell_email` na `system_config`
2. **`src/pages/Upsell.tsx`**: Página completa com formulário, color pickers e preview
3. **`src/App.tsx`**: Nova rota `upsell`
4. **`src/components/layout/AppSidebar.tsx`**: Item "Upsell" em Operações
5. **`supabase/functions/send-email/index.ts`**: Buscar upsell_config, renderizar bloco HTML, cobrar 0,10

