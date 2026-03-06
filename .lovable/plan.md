

## Plano: Botão "Fale Com o Vendedor" via WhatsApp nos E-mails

### Resumo
Adicionar um campo opcional na configuração de postagem onde o lojista informa seu WhatsApp. Quando ativado, todos os e-mails de rastreio incluem um botão verde "Fale Com o Vendedor" que direciona o cliente para `https://wa.me/{numero}`.

### Alterações

#### 1. Banco de dados — nova coluna em `postagem_config`
```sql
ALTER TABLE public.postagem_config ADD COLUMN whatsapp_vendedor text DEFAULT NULL;
```
Quando preenchido = ativo. Quando nulo/vazio = desativado.

#### 2. Frontend — `src/pages/Postagens.tsx`
Adicionar na aba "Configuração" um novo card com:
- Toggle + campo de input para o número de WhatsApp do vendedor
- Label: "Botão WhatsApp no E-mail"
- Descrição: "Adiciona botão 'Fale Com o Vendedor' nos e-mails enviados ao cliente"
- Input: número com DDI (ex: 5511999999999)
- Salvar junto com as outras configs no `saveAll`

#### 3. Backend — `supabase/functions/send-email/index.ts`
Na função `buildEmailHtml`:
- Buscar `whatsapp_vendedor` do `postagem_config` (já é feito fetch da config)
- Se presente, inserir após o CTA principal um botão verde com ícone WhatsApp:
```html
<table style="margin:12px auto 0;">
  <tr><td style="background-color:#25D366;border-radius:50px;">
    <a href="https://wa.me/{numero}" style="color:#fff;padding:12px 36px;...">
      💬 Fale Com o Vendedor
    </a>
  </td></tr>
</table>
```
- Também adicionar na `buildTaxacaoEmailHtml` e `buildFalhaEntregaEmailHtml`

#### 4. Preview — `src/components/postagens/emailTemplates.ts`
Atualizar `buildEmailHtml` do frontend para incluir o botão de WhatsApp na preview quando configurado.

### Arquivos alterados
- **Migração SQL**: nova coluna `whatsapp_vendedor`
- **`src/pages/Postagens.tsx`**: UI do campo + salvar
- **`supabase/functions/send-email/index.ts`**: buscar config, renderizar botão
- **`src/components/postagens/emailTemplates.ts`**: preview do botão (opcional)

