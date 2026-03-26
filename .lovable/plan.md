

## Plan: Toggle "Recebido por Vizinho" em Postagens

### O que muda
Adicionar um switch na aba de Configuração do Postagens para o usuário ativar/desativar a funcionalidade de "Recebido por Vizinho". Quando desativado, o status final mostra apenas "Entregue ao destinatário" sem dados fictícios de vizinho.

### Alterações

**1. Migração — nova coluna `ativar_vizinho` em `postagem_config`**
```sql
ALTER TABLE postagem_config ADD COLUMN ativar_vizinho boolean NOT NULL DEFAULT true;
```

**2. `src/pages/Postagens.tsx`**
- Adicionar `ativar_vizinho` ao tipo `PostagemConfig`
- Adicionar um card/switch na aba de configuração com:
  - **Ativo**: "Recebido por um vizinho" — mostra dados fictícios do recebedor
  - **Desativado**: "Pedido entregue ao destinatário" — sem dados de vizinho
- Salvar no banco junto com as outras configs

**3. `supabase/functions/send-email/index.ts`**
- Buscar `ativar_vizinho` da `postagem_config` da loja
- Condicionar a chamada de `getVizinhoExtras()` — só executa se `ativar_vizinho === true`
- Se desativado, não injetar o bloco HTML do recebedor/vizinho no email

**4. `src/pages/Rastreio.tsx`**
- Buscar `ativar_vizinho` da `postagem_config` usando o `loja_id` do envio
- Condicionar a exibição do bloco vizinho — só mostra se `ativar_vizinho === true`

**5. `src/components/postagens/emailTemplates.ts`**
- Sem alteração estrutural — o template padrão "Entregue" continua com placeholders de vizinho, mas eles só serão preenchidos quando a funcionalidade estiver ativa

### O que não muda
- Lógica de hash determinístico dos nomes/CPFs fictícios
- Templates de email no banco de dados
- Funcionalidade para lojas que mantêm o toggle ativo (comportamento atual = default)

