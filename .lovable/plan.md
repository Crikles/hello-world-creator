

## Plan: Reorganizar Templates do Sistema

### Situação Atual
- **Nacional Padrão** (9 eventos) — inclui Falha na Entrega + Reenvio Pago + Reenvio Saiu
- **Nacional Taxação** (11 eventos) — inclui Taxação + Falha + Reenvio
- **Nacional Expressa** (3 eventos) — será removida

### O que muda
Remover Expressa, criar "Nacional Falha na Entrega", e limpar o Padrão:

1. **Nacional Padrão** (6 eventos): Postado → Coletado → Em Trânsito → Centro Local → Saiu para Entrega → Entregue
2. **Nacional Falha na Entrega** (9 eventos — novo): Postado → Coletado → Em Trânsito → Centro Local → Saiu para Entrega → Falha Entrega → Reenvio Pago → Reenvio Saiu → Entregue
3. **Nacional Taxação** (11 eventos): sem alteração

### Migração SQL

1. **Deletar** o template Expressa (`00000000-...0003`) e seus eventos (cascade)
2. **Remover** os eventos Falha Entrega, Reenvio Pago, Reenvio Saiu do Nacional Padrão (`00000000-...0001`) e reordenar (1-6)
3. **Criar** novo template "Nacional Falha na Entrega" (`00000000-...0004`) com `is_system = true`, tipo `falha_entrega`
4. **Inserir** 9 eventos para o novo template, copiando assuntos/corpos de email dos eventos existentes do Padrão

### Frontend (`src/pages/Postagens.tsx`)
- Sem mudanças de código necessárias — a listagem de templates já é dinâmica via query ao banco. A UI dos badges de status já cobre todos os status_labels usados.

### O que não muda
- Nacional Taxação permanece igual
- Lógica de envio de emails, rastreio, advance-shipments
- Nenhuma loja usa o template Expressa (verificado)

