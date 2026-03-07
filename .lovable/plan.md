

## Plano: Adicionar 2o botão de URL opcional

### Resumo

Adicionar um botão de URL extra opcional (texto + URL customizáveis) para o template de WhatsApp, permitindo ao usuário direcionar para suporte ou qualquer link.

### Alterações

#### 1. Database — nova migração

Adicionar 2 colunas na tabela `postagem_config`:
```sql
ALTER TABLE postagem_config ADD COLUMN whatsapp_btn2_text text DEFAULT NULL;
ALTER TABLE postagem_config ADD COLUMN whatsapp_btn2_url text DEFAULT NULL;
```

#### 2. `src/pages/WhatsApp.tsx` — UI + lógica

- Novos states: `btn2Text`, `btn2Url`
- Carregar e salvar os novos campos (`whatsapp_btn2_text`, `whatsapp_btn2_url`)
- Adicionar 2 inputs na seção de botões (após o reply button): "Texto do 2o Botão URL (opcional)" e "URL do 2o Botão (opcional)"
- No preview, renderizar o botão extra entre o botão de rastreio e o reply (se preenchido)
- No envio individual (`handleSendSingle`), passar `btn2_text` e `btn2_url`
- No envio em massa (`handleSendSelected`), passar `btn2_text` e `btn2_url`

#### 3. `supabase/functions/send-whatsapp/index.ts`

- **Action `send`**: Receber `btn2_text` e `btn2_url`, adicionar ao `choices` após o primeiro botão URL e antes do reply
- **Action `send-queue`**: Buscar `whatsapp_btn2_text` e `whatsapp_btn2_url` do `postagem_config`, adicionar ao `choices`

Ordem final dos botões: Rastreio URL → 2o URL (se configurado) → Reply

### Arquivos alterados
- Nova migração SQL (2 colunas)
- `src/pages/WhatsApp.tsx`
- `supabase/functions/send-whatsapp/index.ts`

