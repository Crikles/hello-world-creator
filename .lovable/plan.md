## Objetivo
Adicionar um terceiro card de template **"Envio Intermediário"** na aba Postagens, apenas visual (placeholder), marcado como **EM BREVE** e desabilitado para clique.

## Alterações

### `src/pages/Postagens.tsx` (bloco "Templates Pré-configurados")
- Após o `.map()` dos `systemTemplates`, renderizar um card estático com:
  - Nome: **Envio Intermediário**
  - Descrição: "Fluxo intermediário com 11 eventos."
  - Badge "11 eventos"
  - 11 chips placeholder em cinza (NF-e, Postado, Coletado, Em Trânsito, Centro de Distribuição, Passando por triagem, Em redistribuição, Unidade final, Saiu para Entrega, Em rota final, Entregue)
  - Badge **EM BREVE** no canto superior direito (estilo igual ao "Ativo" mas em cor muted/secondary)
  - `cursor-not-allowed opacity-60`, sem `onClick`
  - Rodapé com ícone de relógio: "Disponível em breve"

Nenhuma alteração no banco ou backend — é apenas um item visual fixo para ocupar o espaço.