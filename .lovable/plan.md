
# Melhorias na Tabela de Envios

## Problemas Identificados

1. **Status incorreto**: Apos o primeiro avanço (NF), o status mostra "Em Transito" porque a logica atual so usa 4 status fixos (pendente, em_transito, saiu_para_entrega, entregue). Os eventos tem um campo `status_label` com valores mais detalhados (Postado, Coletado, Em Transito, Centro Local, etc.) que devem ser exibidos.

2. **Progresso sem indicador numerico**: A barra de progresso nao mostra em qual etapa o envio esta (ex: "1/6").

3. **Atualizacao em tempo real**: Apos clicar em "Avancar", a tabela precisa atualizar imediatamente.

---

## Solucao

### 1. Novo campo `status_label` na tabela `envios`

Adicionar uma coluna `status_label` (text, nullable) para armazenar o label do evento atual diretamente no envio. Isso permite exibir "Postado", "Coletado", "Centro Local", etc., sem depender dos 4 status fixos.

**Migracao SQL:**
```sql
ALTER TABLE envios ADD COLUMN status_label text;
```

### 2. Atualizar `email-trigger.ts`

Ao avancar um evento, salvar tambem o `status_label` do evento no envio:

```typescript
// Na funcao triggerNextEmail, ao fazer update:
.update({ 
  ultimo_evento_ordem: nextEvent.ordem, 
  status: newStatus,
  status_label: nextEvent.status_label  // NOVO
})
```

### 3. Atualizar `Envios.tsx`

**Status**: Exibir `envio.status_label` quando disponivel, senao usar o mapeamento antigo como fallback.

**Progresso**: Substituir a barra de progresso por um indicador numerico com a barra, mostrando "1/6", "3/6", etc.

**Tempo real**: Usar optimistic updates nas mutations para refletir mudancas imediatamente na UI, e tambem adicionar um listener de realtime na tabela `envios` para capturar mudancas feitas em batch.

---

## Detalhes Tecnicos

### Arquivo: `src/lib/email-trigger.ts`
- Adicionar `status_label: nextEvent.status_label` ao `.update()` (linha 73)

### Arquivo: `src/pages/Envios.tsx`
- Atualizar coluna Status para usar `envio.status_label || statusLabels[envio.status]`
- Atualizar coluna Progresso para mostrar texto "X/N" junto com a barra
- Adicionar `useEffect` com `supabase.channel('envios').on('postgres_changes', ...)` para atualizar a query automaticamente
- Habilitar realtime na tabela envios via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE public.envios;`
- Nas mutations de batch, invalidar queries apos cada avanço individual para feedback imediato
