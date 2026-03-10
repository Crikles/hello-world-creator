

# Personalização de Cores do E-mail e Site de Rastreio

## O que será feito

Adicionar na aba **Configuração** do Postagens um card de personalização de cores, similar ao que já existe na Taxação (`cor_botao`, `cor_header`). O usuário poderá customizar:

- **Cor Primária** (usada nos e-mails de rastreio e no site de rastreio — links, rastreio highlight, barra de progresso)
- **Cor do Botão CTA** (botão "Rastrear Pedido" nos e-mails)

## Alterações

### 1. Banco de Dados — Migration
Adicionar 2 colunas na tabela `postagem_config`:
```sql
ALTER TABLE public.postagem_config
  ADD COLUMN cor_primaria text DEFAULT '#6366f1',
  ADD COLUMN cor_botao_cta text DEFAULT '#1a1a1a';
```

### 2. Frontend — `src/pages/Postagens.tsx`
- Adicionar `cor_primaria` e `cor_botao_cta` ao `PostagemConfig` interface
- Adicionar card de "Personalização Visual" na aba Configuração (após WhatsApp Vendedor), com:
  - Input tipo `color` + campo hex para cor primária
  - Input tipo `color` + campo hex para cor do botão CTA
  - Preview inline mostrando as cores aplicadas
- Incluir as novas colunas no `saveAll` mutation e no `hasChanges` check

### 3. Backend — `supabase/functions/send-email/index.ts`
- Na função `buildEmailHtml`, ler `cor_primaria` e `cor_botao_cta` da `postagem_config` da loja
- Aplicar `cor_primaria` nos destaques do e-mail (código de rastreio, barra decorativa)
- Aplicar `cor_botao_cta` no botão CTA do e-mail (atualmente fixo em `#1a1a1a`)

### 4. Backend — `supabase/functions/rastreio-info/index.ts`
- Retornar `cor_primaria` na resposta da API para que o site de rastreio JL possa usá-la

### 5. Frontend — `src/pages/Rastreio.tsx`
- Ler `cor_primaria` da resposta da API (com fallback para `#6366f1` ou `#D71920` conforme domínio)
- Aplicar na barra de progresso, ícones da timeline e destaques

### 6. Preview no EmailEditor — `src/components/postagens/emailTemplates.ts`
- Passar `primaryColor` do config para o `buildEmailHtml` do preview

## Fluxo de dados
```text
postagem_config.cor_primaria / cor_botao_cta
   ↓
send-email (edge function) → lê do DB → aplica no HTML do email
rastreio-info (edge function) → retorna na API → site de rastreio usa
Postagens UI → salva no DB + preview local
```

