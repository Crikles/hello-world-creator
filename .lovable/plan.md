

# Ajustes no Preview de Taxacao e Campo "Cor do Header"

## Mudanca 1: Transportadora no preview do site

No componente `TaxacaoTrackingPreview` (linha 309), a transportadora mostra `{empresaNome}` (nome da loja do usuario). O correto e exibir um texto fixo de exemplo, ja que na pagina real a transportadora vem do envio. Sera trocado para "JL Transportes" como dado de exemplo.

**Arquivo:** `src/components/postagens/TaxacaoConfig.tsx`
- Linha 309: trocar `{empresaNome}` por `Benedito e Maria Ferragens` (dado de exemplo fixo, igual aos outros dados do preview como "Maria Silva" e "Camiseta Polo Premium")

Na verdade, olhando a imagem do usuario, a transportadora no preview mostra "Benedito e Maria Ferragens" -- esse e o nome da empresa/loja do usuario. O campo transportadora deveria mostrar "JL Transportes" (a transportadora real). Vou fixar como "JL Transportes".

## Mudanca 2: Campo "Cor do Header"

O campo "Cor do Header" existe na configuracao (linha 686-699) mas nao e usado em nenhum lugar visivel:
- Na pagina `/p` real, o header e branco fixo
- No preview do site, o header tambem e branco fixo

**Opcao escolhida:** Remover o campo "Cor do Header" do formulario e manter apenas "Cor do Botao". O campo `cor_header` continua sendo salvo no corpo do email (para nao quebrar compatibilidade), mas o input visual sera removido ja que nao tem efeito pratico em nenhuma pagina.

## Detalhes Tecnicos

### Arquivo: `src/components/postagens/TaxacaoConfig.tsx`

1. **Linha 309** — Trocar `{empresaNome}` por `JL Transportes` no campo Transportadora do preview
2. **Linhas 684-699** — Remover o grid de 2 colunas das cores e deixar apenas "Cor do Botao" como campo unico (remover "Cor do Header")
3. **Linha 700+** — Ajustar o grid da "Cor do Botao" para ocupar a largura completa em vez de metade

O `cor_header` continuara sendo salvo no `corpo_email` para manter compatibilidade com dados existentes, mas o usuario nao vera mais esse campo na interface.

