## Problema

No e-mail (ex.: "Nota Fiscal Emitida"), o campo **TRANSPORTADORA** mostra "ATLAS Transportes" mesmo quando o código de rastreio é da **JETLINE** (sufixo `JL`, ex.: `BR308EE00E05JL`).

## Causa raiz

Em `supabase/functions/send-email/index.ts`, a função `resolveTransportadora` está com dois bugs:

```ts
// linha 186
if (code.endsWith("JL")) return "ATLAS Transportes";   // ❌ deveria ser JETLINE
// linha 188
if (stored.toUpperCase().includes("JL")) return DEFAULT_TRANSPORTADORA; // ❌ sobrescreve qualquer "JETLINE" salvo
```

Ou seja, mesmo a `envios.transportadora` já vindo gravada como `JETLINE Logística` (o trigger `generate_tracking_code` faz isso corretamente no banco), o `send-email` sobrescreve para ATLAS.

## Correção

Editar `supabase/functions/send-email/index.ts` — função `resolveTransportadora`:

1. Linha 186: trocar para `return "JETLINE Logística";`
2. Linha 188: remover a regra que descarta valores contendo "JL" (essa regra estava forçando ATLAS quando o valor armazenado mencionava JL).

Resultado final:

```ts
function resolveTransportadora(envio: Record<string, unknown>): string {
  const code = ((envio.codigo_rastreio as string) || "").toUpperCase();
  if (code.endsWith("AT")) return "ATLAS Transportes";
  if (code.endsWith("VT")) return "Vetor Transportes";
  if (code.endsWith("JD")) return "Jadlog";
  if (code.endsWith("JL")) return "JETLINE Logística";
  const stored = (envio.transportadora as string) || "";
  if (stored.trim()) return stored;
  return DEFAULT_TRANSPORTADORA;
}
```

## Escopo

- Não altera banco, RLS, frontend, nem fluxo global — só esse único helper na edge function de e-mails.
- `rastreio-info` e `pagamento-info` já usam `envio.transportadora` armazenada (que o trigger preenche corretamente), então não precisam mudar.
- E-mails novos passam a exibir "JETLINE Logística" para códigos `…JL`; e-mails já enviados não são afetados.
