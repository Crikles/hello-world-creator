

## Plano: Substituir domínio antigo por magnusfrete.com

### Locais encontrados

1. **`src/pages/Indicacao.tsx`** (linha 63)
   - Atual: `https://app.magnusfrete.site/signup?ref=...`
   - Novo: `https://magnusfrete.com/signup?ref=...`

2. **`src/pages/admin/AdminUsuarios.tsx`** (linha 594)
   - Atual: `https://magnusfrete.lovable.app/signup?ref=...`
   - Novo: `https://magnusfrete.com/signup?ref=...`

### O que não muda
- Edge functions (`send-whatsapp`, `admin-verification-whatsapp`) usam "magnusfrete" como nome de instância do WhatsApp, não como domínio — não precisam ser alterados.
- Nenhuma referência ao domínio antigo foi encontrada no banco de dados (`system_config`).

### Ação necessária do usuário
- O domínio `magnusfrete.com` precisa estar configurado como domínio customizado do projeto em **Settings → Domains**. Se ainda não estiver, será necessário adicioná-lo e configurar os registros DNS.

