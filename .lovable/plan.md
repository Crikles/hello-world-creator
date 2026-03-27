

## Plan: Card de aviso sobre boas práticas de copy no Upsell

### Alteração

**`src/pages/Upsell.tsx`** — Adicionar um card de alerta informativo acima do formulário (dentro do `UpsellForm`, antes do grid de 2 colunas), com ícone de alerta/info e texto orientando o usuário.

### Conteúdo do card

- Ícone `AlertTriangle` ou `Info` do lucide-react
- Título: "Dica importante sobre a copy do seu Upsell"
- Texto orientativo:
  - Evitar palavras agressivas como "GRÁTIS", "URGENTE", "COMPRE AGORA", "ÚLTIMA CHANCE", excesso de letras maiúsculas e pontuação (!!!)
  - Usar linguagem leve e natural, como se estivesse recomendando algo a um amigo
  - Copies agressivas podem fazer o e-mail cair no spam ou nem chegar ao destinatário
  - Sugestão: usar frases como "Você também pode gostar de...", "Selecionamos algo especial para você"

### Visual
- Card com estilo `bg-amber-500/10 border-amber-500/30` (tom de aviso suave, compatível com tema escuro)
- Posicionado logo acima do grid form + preview, visível em ambas as tabs

### Arquivo alterado
- `src/pages/Upsell.tsx` (apenas)

