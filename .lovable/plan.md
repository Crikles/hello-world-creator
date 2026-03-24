

## Apelido Customizado + Seletor Multi-Instância Redesenhado

### Problema
1. Usuários não conseguem identificar suas instâncias — só veem o ID técnico (`magnus-xxx`)
2. O seletor de instância na aba "Enviar" é um dropdown simples que só permite "todas" ou "uma"

### Plano

#### 1. Migração: Adicionar coluna `label` na tabela `whatsapp_instances`
```sql
ALTER TABLE public.whatsapp_instances ADD COLUMN label text;
```
Coluna nullable — quando vazia, exibe o `instance_name` como fallback.

#### 2. Frontend — Campo de apelido editável (aba Instâncias)
**Arquivo: `src/pages/WhatsApp.tsx`**

No card de cada instância (onde mostra `inst.instance_name`), adicionar:
- Exibir `inst.label || inst.instance_name` como nome principal
- Mostrar `inst.instance_name` em texto menor/mono abaixo (ID técnico)
- Botão de edição (ícone lápis) que abre um input inline para o usuário digitar o apelido
- Ao salvar, faz `UPDATE whatsapp_instances SET label = '...' WHERE id = inst.id`

#### 3. Frontend — Redesenhar seletor na aba "Enviar"
**Arquivo: `src/pages/WhatsApp.tsx`** (linhas ~1135-1176)

Substituir o `Select` dropdown por um seletor visual com checkboxes:
- Cada instância conectada aparece como um card/chip com checkbox
- Mostra o `label` (ou `instance_name`), telefone e status visual
- Botão "Selecionar todas" / "Nenhuma" no topo
- O estado muda de `selectedInstanceId: string` para `selectedInstanceIds: Set<string>`
- Quando múltiplas selecionadas, rotação automática entre as selecionadas
- Quando nenhuma selecionada, desabilita o botão de envio

#### 4. Ajustar lógica de envio
Atualizar a mutação de envio para usar `selectedInstanceIds` (array) ao invés de `selectedInstanceId` (string "all" ou ID único), enviando a lista de IDs selecionados para a edge function.

### Resultado
- Usuários identificam instâncias pelo apelido que escolherem (ex: "Loja SP", "Suporte")
- Seletor visual com checkboxes permite escolher quais instâncias usar no envio
- ID técnico continua visível em texto menor para referência

