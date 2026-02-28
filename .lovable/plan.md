
# Corrigir nome "Loja" e logo ausente nos e-mails

## Problema

Quando um pedido chega via webhook (Zedy, Corvex, Luna, Vega), o envio e criado **sem o campo `empresa_id`**. Na hora de enviar o e-mail, a edge function `send-email` so busca os dados da empresa se `envio.empresa_id` existir (linha 614). Como esta null, usa o fallback "Loja" sem logo.

## Solucao

Alterar a edge function `send-email/index.ts` para, quando `empresa_id` estiver vazio, buscar a empresa pela `loja_id` do envio. Isso garante que o nome e logo da empresa configurada no painel sejam sempre usados.

Tambem atualizar todos os 4 webhooks (Zedy, Corvex, Luna, Vega) para ja gravar o `empresa_id` no envio no momento da criacao, evitando o problema na origem.

## Alteracoes

### 1. `supabase/functions/send-email/index.ts`

Na secao de "Fetch empresa data" (linhas 610-626), adicionar fallback por `loja_id`:

```text
// Fetch empresa data
let fromName = "Loja";
let empresaLogoUrl = "";
let empresaNome = "Loja";

// Tentar por empresa_id primeiro
if (envio.empresa_id) {
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome_fantasia, razao_social, logo_url")
    .eq("id", envio.empresa_id)
    .single();
  if (empresa) {
    fromName = empresa.nome_fantasia || empresa.razao_social || "Loja";
    empresaNome = fromName;
    empresaLogoUrl = empresa.logo_url || "";
  }
}

// Fallback: buscar por loja_id se empresa_id nao existir ou nao retornou dados
if (empresaNome === "Loja" && envio.loja_id) {
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome_fantasia, razao_social, logo_url")
    .eq("loja_id", envio.loja_id)
    .maybeSingle();
  if (empresa) {
    fromName = empresa.nome_fantasia || empresa.razao_social || "Loja";
    empresaNome = fromName;
    empresaLogoUrl = empresa.logo_url || "";
  }
}
```

### 2. Webhooks (Zedy, Corvex, Luna, Vega)

Em cada webhook, antes de criar o envio, buscar a empresa da loja e incluir `empresa_id` no insert:

- `supabase/functions/webhook-zedy/index.ts`
- `supabase/functions/webhook-corvex/index.ts`
- `supabase/functions/webhook-luna/index.ts`
- `supabase/functions/webhook-vega/index.ts`

Adicionar antes do insert do envio:
```typescript
// Buscar empresa da loja
const { data: empresaData } = await supabase
  .from("empresas")
  .select("id")
  .eq("loja_id", lojaId)
  .maybeSingle();
```

E incluir no objeto `envioData`:
```typescript
empresa_id: empresaData?.id || null,
```

## Resultado

- E-mails enviados via webhook mostrarao o nome da empresa (ex: "MOMENTUS LTDA") e a logo configurada no painel
- A correcao no `send-email` funciona retroativamente para envios ja existentes sem `empresa_id`
- Os webhooks passam a gravar o `empresa_id` para evitar o fallback no futuro
