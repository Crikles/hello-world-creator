

# Atualizar dominio para rastreio.logisticajltransportes.com

Trocar todas as referencias do dominio antigo para o novo subdominio em 4 arquivos.

## Alteracoes

### 1. `src/lib/domain-config.ts`
Atualizar a lista de dominios de logistica:
- `logisticajltransportes.com` -> `rastreio.logisticajltransportes.com`
- `www.logisticajltransportes.com` -> `www.rastreio.logisticajltransportes.com` (remover, subdominio nao precisa de www)

### 2. `src/pages/Rastreio.tsx`
Atualizar o email de contato no rodape:
- `contato@logisticajltransportes.com` -- manter ou atualizar conforme preferencia (email nao muda com subdominio)

### 3. `supabase/functions/send-email/index.ts`
Atualizar a URL do botao CTA nos emails:
- `https://magnusfrete.lovable.app/r/` -> `https://rastreio.logisticajltransportes.com/r/`

### 4. `src/components/postagens/emailTemplates.ts`
Atualizar todas as 8 URLs de `url_botao_cta` nos templates padrao:
- `https://magnusfrete.lovable.app/r/{{codigo_rastreio}}` -> `https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}`

## Resultado
Os emails enviados terao links apontando para `rastreio.logisticajltransportes.com/r/CODIGO` e o sistema reconhecera o subdominio como dominio de logistica, renderizando a pagina de rastreio corretamente.

