

# Seletor de Instância na Aba "Enviar"

## O que será feito

Adicionar um seletor de instância na aba "Enviar" do WhatsApp, permitindo ao usuário escolher qual instância conectada será usada para o envio de mensagens. Ficará posicionado logo acima do bloco "Envio Automático".

## Implementação

### Arquivo: `src/pages/WhatsApp.tsx`

1. **Novo estado** `selectedInstanceId` para armazenar a instância escolhida (default: primeira conectada ou "all" para rotação).

2. **Componente seletor** — Um bloco visual com ícone e `Select` dropdown listando:
   - "Todas (rotação automática)" — comportamento atual
   - Cada instância conectada individualmente (nome + telefone)

3. **Filtrar instância no envio** — Alterar `handleSendSingle` e `handleSendSelected` para passar `instance_id` quando uma instância específica estiver selecionada (em vez de deixar o backend rotacionar).

4. **Feedback visual** — Mostrar qual instância está selecionada com um indicador de status (bolinha verde).

### Arquivos modificados
- `src/pages/WhatsApp.tsx` — estado + seletor UI + lógica de envio

