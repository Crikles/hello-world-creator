
# Corrigir cobranca de precos personalizados no avanço automático

## Problema encontrado

Existem **dois caminhos** que avançam envios e debitam moedas:

1. **Client-side** (`src/lib/email-trigger.ts`) -- Busca `custom_prices` do perfil do usuario e aplica corretamente. Funciona bem.

2. **Edge Function** (`supabase/functions/advance-shipments/index.ts`) -- Busca apenas os precos globais da tabela `system_config` e **ignora completamente** os precos personalizados do usuario. Este e o caminho usado pelo cron automatico.

Ou seja, quando o avanço e feito automaticamente (cron), o usuario e cobrado pelo preco global, nao pelo personalizado.

## Solucao

Alterar a edge function `advance-shipments` para buscar o `custom_prices` do perfil do usuario e sobrescrever os valores globais quando existirem precos personalizados.

## Alteracao tecnica

**Arquivo**: `supabase/functions/advance-shipments/index.ts`

Dentro do loop principal (por config/loja), apos buscar os custos globais do `system_config`, adicionar:

1. Buscar `custom_prices` do perfil do usuario (`profiles.custom_prices` onde `id = lojaUserId`)
2. Sobrescrever os valores do `costMap` com os precos personalizados quando existirem

Trecho atual (linhas 348-354):
```text
// Fetch costs
const { data: costs } = await supabase
  .from("system_config")
  .select("key, value");

const costMap: Record<string, number> = {};
if (costs) for (const c of costs) costMap[c.key] = Number(c.value);
```

Sera alterado para:
```text
// Fetch global costs
const { data: costs } = await supabase
  .from("system_config")
  .select("key, value");

const costMap: Record<string, number> = {};
if (costs) for (const c of costs) costMap[c.key] = Number(c.value);

// Apply custom per-user prices if configured
const { data: profileData } = await supabase
  .from("profiles")
  .select("custom_prices")
  .eq("id", lojaUserId)
  .single();

const customPrices = (profileData?.custom_prices as Record<string, number>) || {};
for (const [key, val] of Object.entries(customPrices)) {
  if (val !== undefined && val !== null) {
    costMap[key] = Number(val);
  }
}
```

Isso garante que tanto o fluxo manual quanto o automatico respeitam os precos personalizados por usuario.
