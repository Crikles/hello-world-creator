

# Corrigir PDF Dourado e Nome Aleatorio da DANFE

## Problemas Encontrados

### 1. Texto dourado no PDF
O `replace('#b8860b', '#000')` do JavaScript so substitui a **primeira ocorrencia**. Como a cor `#b8860b` aparece no CSS (na regra `.empresa-value`) e tambem e usada no HTML body via a classe, o replace nao pega todas. Solucao: usar `replaceAll` em vez de `replace`.

Isso afeta **dois arquivos**:
- `src/components/danfe/DanfePreview.tsx` (linha 375) - botao "Baixar PDF"
- `src/lib/nfe-utils.ts` (linha 30) - geracao de PDF base64 para email

### 2. Nome do arquivo ainda usa nome da loja
Na linha 401 de `DanfePreview.tsx`, o save usa `DANFE_${empresa.razao_social}`. Precisa trocar para nome aleatorio no formato `DANFE_4737288372_30483.pdf`.

## Mudancas

### `src/components/danfe/DanfePreview.tsx`
- Linha 375: trocar `.replace(` por `.replaceAll(`
- Linha 401: trocar `pdf.save(...)` para usar nome aleatorio:
  ```typescript
  const part1 = Math.floor(Math.random() * 9999999999).toString().padStart(10, '0');
  const part2 = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  pdf.save(`DANFE_${part1}_${part2}.pdf`);
  ```

### `src/lib/nfe-utils.ts`
- Linha 30: trocar `.replace(` por `.replaceAll(`

Ambas as mudancas sao simples - uma palavra e uma linha cada.

