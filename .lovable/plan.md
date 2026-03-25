

## Plano: Blindagem contra Ataques XSS e Abuso de Cadastro

Sobre bloqueio de IP: infelizmente não é possivel bloquear IPs diretamente no nível do backend atual (seria necessário um proxy/WAF como Cloudflare). Porém, podemos implementar várias camadas de proteção eficazes.

### Mudanças

**1. Sanitização do campo Nome no cadastro (client-side)**
- Arquivo: `src/components/ui/premium-auth.tsx`
- Rejeitar nomes com caracteres HTML (`<`, `>`, `"`, `'`, `&`) no campo de validação
- Limitar tamanho máximo do nome a 60 caracteres
- Mostrar erro claro: "Nome contém caracteres inválidos"

**2. Bloqueio de domínios de email descartáveis (client-side)**
- Arquivo: `src/components/ui/premium-auth.tsx`
- Manter lista de domínios descartáveis conhecidos (sharebot.net, tempmail, guerrillamail, etc.)
- Validar no campo email e bloquear cadastro com esses domínios

**3. Sanitização server-side no trigger `handle_new_user` (migração)**
- Alterar a função SQL para limpar HTML do `full_name` antes de gravar no profiles
- Usar `regexp_replace` para remover tags HTML do nome

**4. Instalar DOMPurify e sanitizar `dangerouslySetInnerHTML` (4 arquivos)**
- `src/pages/WhatsApp.tsx` — preview de mensagem WhatsApp
- `src/pages/Rastreio.tsx` — CSS inline
- `src/components/postagens/FailedDeliveryConfig.tsx` — preview de email
- Envolver conteúdo dinâmico com `DOMPurify.sanitize()` antes de renderizar

**5. Validação de WhatsApp no cadastro**
- Limitar campo phone a máximo 15 dígitos para evitar inputs absurdos

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/components/ui/premium-auth.tsx` | Validação de nome e email |
| Migração SQL | Sanitizar `handle_new_user` |
| `src/pages/WhatsApp.tsx` | DOMPurify |
| `src/pages/Rastreio.tsx` | DOMPurify |
| `src/components/postagens/FailedDeliveryConfig.tsx` | DOMPurify |

