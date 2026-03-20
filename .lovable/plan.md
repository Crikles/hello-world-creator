

## Plano: Preencher campos obrigatórios da NF-e com valores padrão

### Problema
A DANFE gerada no servidor (edge function `resend-nfe`) está enviando campos em branco para NCM/SH, CST, CFOP e número da NF-e quando o envio não tem esses dados preenchidos. O frontend já tem defaults, mas o backend não.

### Correção

**Arquivo 1: `supabase/functions/resend-nfe/index.ts`** — Função `generateDanfePdf`

Adicionar valores padrão nos campos fiscais dos produtos e no número da NF-e:
- `ncm_sh` → fallback `"00000000"`
- `cst` → fallback `"000"`  
- `cfop` → fallback `"5102"`
- `nfe_numero` → gerar número aleatório formatado (ex: `"000.123.456"`) baseado em hash do envio.id para ser determinístico
- `nfe_serie` → fallback `"001"`
- `nfe_chave_acesso` → gerar chave de 44 dígitos aleatória baseada no envio.id

**Arquivo 2: `src/components/danfe/DanfePreview.tsx`** — Coluna CST

A tabela de produtos no frontend não exibe a coluna CST (a imagem mostra que está faltando). Verificar se o header "CST" existe na tabela HTML e adicionar se necessário, com o mesmo fallback `"000"`.

Ambos os locais (frontend e backend) terão os mesmos valores padrão para consistência.

