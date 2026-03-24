

## Separar aba Enviar em "Pendentes" e "Enviados"

### O que muda

Na aba "Enviar" (tab `send`), a lista de envios sera dividida em duas sub-abas:

1. **Pendentes** - Envios que ainda NAO receberam mensagem WhatsApp (nao estao no `sentEnvioIds`)
2. **Enviados** - Envios que JA receberam mensagem com sucesso (estao no `sentEnvioIds`)

Quando um envio receber a mensagem, ele sai automaticamente de Pendentes e aparece em Enviados (ja acontece via `whatsapp_message_log` query).

### Implementacao

**Arquivo: `src/pages/WhatsApp.tsx`**

1. Adicionar estado `sendSubTab` com valores `"pendentes" | "enviados"`

2. Substituir o filtro `filterStatus` (dropdown "Todos/Enviado/Nao Enviado") por duas sub-abas visuais (botoes/pills) dentro da action bar:
   - "Pendentes (X)" - filtra `filteredEnvios` onde `!sentEnvioIds.has(e.id)`
   - "Enviados (X)" - filtra onde `sentEnvioIds.has(e.id)`

3. Na sub-aba **Pendentes**:
   - Mostrar checkbox de selecao, botao "Enviar", busca
   - Lista com botao de envio individual (icone Send verde)
   - Apos envio com sucesso, o item migra para "Enviados" automaticamente (ja funciona via invalidacao do query `whatsapp-message-log`)

4. Na sub-aba **Enviados**:
   - Remover checkbox de selecao e botao de envio
   - Mostrar badge "Enviado" com check verde
   - Manter busca
   - Layout mais limpo, sem acoes de envio

5. Remover o dropdown `Select` de filtro (Todos/Enviado/Nao Enviado) que sera substituido pelas sub-abas

### Notas
- Nenhuma mudanca no banco de dados necessaria
- O `whatsapp_message_log` ja rastreia o status "sent" por `envio_id`
- A contagem em cada sub-aba atualiza automaticamente apos envio

