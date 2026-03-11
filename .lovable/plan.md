

# Reenviar NF-e corrigidas para clientes afetados

## Problema
O `parseProductItems` no servidor (`advance-shipments/index.ts`) tem o mesmo bug que foi corrigido no frontend — itens JSON sem campo `valor` individual resultam em R$ 0,00 na DANFE. Clientes que já receberam a NF-e ficaram com valores zerados.

## Solução

### 1. Corrigir `parseProductItems` no servidor (`advance-shipments/index.ts`, linha 28-46)
Aplicar a mesma lógica de distribuição de `envio.valor` entre itens sem `valor`:

```typescript
function parseProductItems(envio: any): ProductItem[] {
  const raw = envio.produto || "";
  if (raw.startsWith("[")) {
    try {
      const items = JSON.parse(raw) as ProductItem[];
      if (Array.isArray(items) && items.length > 0) {
        // Distribute envio.valor if items lack individual valor
        const hasAnyValor = items.some(i => i.valor && i.valor > 0);
        if (!hasAnyValor && envio.valor && envio.valor > 0) {
          const totalQty = items.reduce((s, i) => s + (i.quantidade || 1), 0);
          items.forEach(i => { i.valor = envio.valor / totalQty; });
        }
        // Inherit fiscal fields
        items.forEach(i => {
          if (!i.cfop) i.cfop = envio.cfop;
          if (!i.ncm_sh) i.ncm_sh = envio.ncm_sh;
          if (!i.cst) i.cst = envio.cst;
          if (!i.unidade) i.unidade = envio.unidade;
        });
        return items;
      }
    } catch { /* fallthrough */ }
  }
  return [{ codigo: 1, nome: raw || "Produto", quantidade: envio.quantidade || 1,
    valor: envio.valor || 0, cfop: envio.cfop, ncm_sh: envio.ncm_sh, cst: envio.cst, unidade: envio.unidade }];
}
```

### 2. Criar edge function `resend-nfe` (uso único)
Função que pode ser invocada manualmente para reenviar NF-e corrigidas:

- Recebe `loja_id` no body
- Busca todos envios da loja que já passaram por um evento com `enviar_nfe_pdf = true` (via `postagem_email_log` ou checando `ultimo_evento_ordem`)
- Para cada envio afetado:
  1. Busca dados da empresa
  2. Gera PDF corrigido (com `parseProductItems` corrigido)
  3. Upload no bucket `nfe-pdfs`
  4. Invoca `send-email` com o evento de NF-e correto
  5. **Sem cobrança** (sem chamar `debit_user_credits`)
- Processamento sequencial com delay de 500ms para evitar rate limit

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/advance-shipments/index.ts` | Fix `parseProductItems` para distribuir valor (mesma correção do frontend) |
| `supabase/functions/resend-nfe/index.ts` | Nova edge function para reenvio em massa sem custo |

Após o reenvio, a função `resend-nfe` pode ser removida.

