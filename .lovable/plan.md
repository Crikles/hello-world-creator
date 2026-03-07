

## Plano: Corrigir botão "Nova Instância" e fluxo de conexão QR Code

### Problemas identificados

1. **Botão "Nova Instância" desabilitado após compra**: As queries (`creditos`, `whatsapp-subscriptions`) são invalidadas mas não aguardam o refetch completar. O estado `canAfford` e `freeSlots` permanecem stale até o próximo render, mantendo o botão desabilitado.

2. **QR Code / Código não aparece**: O `connectMutation` depende de refetch do banco para mostrar o QR Code. Se a resposta da API for rápida mas o refetch demorar, nada é exibido. Além disso, o polling de status (a cada 5s) pode sobrescrever o estado "connecting" para "disconnected" antes do usuário escanear.

3. **Sem opção de reconectar**: Se o polling muda o status para "disconnected" e limpa o `qr_code`/`pairing_code`, o botão de conectar reaparece mas o usuário perde contexto.

### Alterações em `src/pages/WhatsApp.tsx`

#### Fix 1: Forçar refetch após criação
- Trocar `invalidateQueries` por `refetchQueries` com `await` no `onSuccess` do `createInstanceMutation`
- Isso garante que `creditos`, `whatsapp-subscriptions` e `whatsapp-instances` estejam atualizados antes do re-render

#### Fix 2: Usar resposta do connect diretamente
- Criar estado local `connectData` (`{ instanceId, qrCode, pairingCode }`)
- No `onSuccess` do `connectMutation`, salvar os dados da resposta no estado local
- Na renderização, priorizar `connectData` sobre os dados do banco para QR Code e pairing code
- Limpar `connectData` quando o status mudar para "connected"

#### Fix 3: Proteger polling contra override prematuro
- No polling de status, não sobrescrever para "disconnected" se o estado atual local é "connecting" e ainda não passou tempo suficiente (ex: 2 minutos)
- Adicionar botão "Reconectar" visível quando status é "disconnected" e a instância não está expirada (já existe na linha 728, mas garantir que funcione independente do polling)

### Arquivos alterados
- `src/pages/WhatsApp.tsx` — refetch queries, estado local para QR/pairing, proteção no polling

