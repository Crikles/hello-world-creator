## Objetivo
Garantir que **todos** os custos cobrados pela operação apareçam editáveis em `Admin → Valores`. Hoje a tela só mostra 5 chaves, mas o código cobra outras 8 que estão "hardcoded" como fallback (ex.: SMS de rastreio, taxação, falha na entrega, recuperação PIX/carrinho, upsell).

## Custos faltantes (atualmente sem registro em `system_config`)

| Chave | Onde é cobrado | Padrão sugerido |
|---|---|---|
| `custo_sms_rastreio` | `email-trigger.ts`, `advance-shipments` (SMS por evento de rastreio) | 0.25 |
| `custo_taxacao` | Funil de Taxação | 1.00 |
| `custo_falha_entrega` | Funil de Falha na Entrega | 1.00 |
| `custo_recovery_email_pix` | `send-recovery-email` (PIX pendente) | 0.10 |
| `custo_recovery_sms_pix` | `send-recovery-sms` (PIX pendente) | 0.15 |
| `custo_recovery_email_carrinho` | `send-recovery-email` (carrinho abandonado) | 0.10 |
| `custo_recovery_sms_carrinho` | `send-recovery-sms` (carrinho abandonado) | 0.15 |
| `custo_upsell_email` | `send-email` (e-mail de upsell) | 0.10 |

## Mudanças

1. **Migration** — `INSERT ... ON CONFLICT DO NOTHING` das 8 chaves acima em `system_config`, cada uma com um `label` amigável. Também faz `UPDATE` dos 5 existentes (`custo_confirmacao_email`, `custo_confirmacao_sms`, `custo_email_rastreio`, `custo_nfe_email`, `custo_whatsapp`) para gravar `label` legível, já que hoje estão vazios.

2. **`src/pages/admin/AdminValores.tsx`** — pequenos ajustes:
   - `getDisplayLabel` passa a usar `config.label` como nome principal e mantém a `key` (mono) como subtítulo (já é assim, só revisa fallback).
   - Agrupar visualmente em 3 seções para facilitar edição: **Rastreio & NF-e**, **Confirmação de Pagamento**, **Recuperação de Vendas**, **Outros** (suporte/URL). Filtro por prefixo de chave, sem mudar lógica de salvar.

3. **Sem mudanças de cobrança** — toda a lógica de débito já lê de `system_config` (com `custom_prices` por usuário sobrescrevendo). Só estamos populando o que faltava.

## Resultado
A tela `Admin → Valores` passa a listar **13 custos** (5 atuais + 8 novos) + WhatsApp suporte + URL base de rastreio, todos editáveis, com nomes amigáveis e agrupados por contexto. Qualquer alteração reflete imediatamente nos webhooks/edge functions.