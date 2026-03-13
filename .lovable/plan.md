

## Plano: Logo da empresa apenas em Falha na Entrega e Taxação

### Situação atual
- **Rastreio** (`Rastreio.tsx` linha 149-150): Usa sempre logo da transportadora (JADLOG/JL) — **correto, manter assim**
- **PagamentoFalha** (`PagamentoFalha.tsx` linha 136-137): Quando é JADLOG, ignora `empresa.logo_url` e `empresa.nome_fantasia` — **precisa corrigir**

### Alteração

**`src/pages/PagamentoFalha.tsx` (linhas 136-137)** — Priorizar dados da empresa:

```typescript
const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || (isJadlog ? "JADLOG Logística" : "Logística JL Transportes");
const logoUrl = empresa?.logo_url || (isJadlog ? "/logojadlog.png" : "/logojltransportes.png");
```

Isso faz com que a logo e nome da loja apareçam na página de Falha na Entrega (e Taxação que já tem lógica similar), enquanto o Rastreio continua mostrando apenas a marca da transportadora.

### Verificação adicional
Preciso confirmar se a página de Taxação (`src/pages/Taxacao.tsx` ou `/p`) também precisa do mesmo ajuste.

