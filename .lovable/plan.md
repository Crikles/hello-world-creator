

## Plan: Mover cores para dentro de cada card de seção

### Conceito
Remover o card "Cores" separado no final e distribuir os color pickers dentro de cada seção relevante, para que o usuário personalize a cor no contexto certo.

### Alteração: `src/pages/RecuperacaoVendas.tsx`

1. **Card "Configuração Geral"** (linhas ~456-476) — Adicionar dentro dele:
   - `ColorPicker` de "Títulos" (`cor_titulo`)
   - `ColorPicker` de "Texto" (`cor_texto`)
   - `ColorPicker` de "Destaque" (`cor_destaque`)

2. **SectionToggle "Botão (CTA)"** (linhas ~518-520) — Adicionar dentro:
   - `ColorPicker` de "Cor do Botão" (`cor_botao`)

3. **SectionToggle "Cupom de Desconto"** (linhas ~501-512) — Adicionar dentro:
   - `ColorPicker` de "Fundo Cupom" (`cor_fundo_cupom`)
   - `ColorPicker` de "Borda Cupom" (`cor_borda_cupom`)
   - `ColorPicker` de "Texto Cupom" (`cor_cupom_texto`)

4. **Remover** o card "Cores" completo (linhas 526-550).

### Arquivo alterado
- `src/pages/RecuperacaoVendas.tsx` (apenas)

