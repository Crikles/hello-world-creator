

## Plan: Aviso de limite de 160 caracteres com variáveis no SMS

### Alteração: `src/pages/RecuperacaoVendas.tsx`

Adicionar um bloco de alerta visível (usando componente `Alert` com ícone de aviso) abaixo de cada textarea de SMS e também um alerta geral no topo da aba SMS, explicando que:

- O limite de 160 caracteres é **após a substituição das variáveis** (`{nome}`, `{produto}`, `{link}`)
- Se o SMS final ultrapassar 160 caracteres com os dados reais do lead, **ele não será enviado**
- Sugestão: usar nomes curtos de variáveis e manter o template bem abaixo de 160

### Detalhes técnicos

1. **Alerta geral no topo da aba SMS** — Box amarelo/laranja com ícone `AlertTriangle`:
   - Texto: "⚠️ Atenção: O limite de 160 caracteres inclui os valores reais das variáveis. Ex: `{nome}` será substituído pelo nome do cliente, `{produto}` pelo nome do produto e `{link}` pela URL completa do checkout. Se o SMS final ultrapassar 160 caracteres, ele **não será enviado**. Mantenha seus templates curtos."

2. **Contador existente** — Manter o `X/160` já existente, sem mudanças.

### Arquivo alterado
- `src/pages/RecuperacaoVendas.tsx` (apenas)

