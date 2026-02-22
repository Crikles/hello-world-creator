

## Aumentar a Altura e Legibilidade do Preview da DANFE

### Problema
O preview da DANFE na coluna direita esta muito comprimido - o `scale(0.58)` e a altura de `580px` do container fazem o texto ficar ilegivel.

### Solucao

Modificar `src/pages/Empresa.tsx` (linhas 346-354) com os seguintes ajustes:

- **Aumentar a escala** de `0.58` para `0.72` - o texto ficara ~24% maior e mais legivel
- **Aumentar a altura do container** de `580px` para `820px` - mostrando mais conteudo da nota sem necessidade de scroll
- **Ajustar o width/height percentual** do wrapper interno de `172.4%` para `138.9%` (100/0.72) para compensar a nova escala
- **Aumentar a altura do iframe** de `1000px` para `1200px` para garantir que toda a DANFE caiba

### Arquivo modificado
- `src/pages/Empresa.tsx` - Apenas os valores de escala e dimensoes na secao do preview (linhas 346-354)
