

# Plano: Corrigir Push Notifications para 100% de Envio

## Problemas Identificados

1. **Duas notificacoes duplicadas no navegador**: O componente `PushNotificationPrompt` (push) e `InstallAppPrompt` (PWA install) aparecem simultaneamente na pagina de Rastreio com a mesma mensagem "Fique por dentro!", causando dois banners sobrepostos.

2. **Falha no envio de push (0 enviados, todas falhas)**: A funcao `send-push-notification` usa `crypto.subtle.importKey("pkcs8", ...)` para importar a chave VAPID privada, mas chaves VAPID sao tipicamente raw EC keys de 32 bytes (formato JWK ou raw), nao formato PKCS8. Isso causa erro na assinatura do JWT e falha em todos os envios.

3. **iOS requer PWA instalado primeiro**: No iOS, Web Push so funciona quando o app esta instalado como PWA (adicionado a Tela de Inicio). O fluxo atual mostra o prompt de push antes da instalacao do PWA.

## Solucao

### Tarefa 1: Unificar os dois prompts em um unico componente

Mesclar `PushNotificationPrompt` e `InstallAppPrompt` em um unico componente inteligente:

- **Android/Chrome**: Mostrar um unico banner que pede permissao de notificacao push diretamente (sem necessidade de instalar PWA para push funcionar no Android)
- **iOS Safari**: Mostrar um unico banner que guia o usuario a instalar o PWA primeiro (Adicionar a Tela de Inicio), porque push so funciona em PWA no iOS
- **Se ja instalado/permitido**: Nao mostrar nada
- Usar um unico localStorage key para controlar se ja foi exibido
- Remover o componente `PushNotificationPrompt` separado
- Atualizar `InstallAppPrompt` para ser o unico componente, incorporando a logica de push subscription

No `Rastreio.tsx`, remover o import/uso de `PushNotificationPrompt` e manter apenas o componente unificado.

### Tarefa 2: Corrigir o formato da chave VAPID na Edge Function

O problema principal de 0% de envio esta na funcao `createVapidJwt` dentro de `send-push-notification/index.ts`:

```text
Atual (falha):
  crypto.subtle.importKey("pkcs8", rawBytes, ...)

Correto:
  crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: base64url_key, x: ..., y: ... }, ...)
```

A correcao envolve:
- Converter a chave VAPID privada (raw 32 bytes base64url) para formato JWK antes de importar
- Derivar os componentes x/y da chave publica VAPID para montar o JWK completo
- Alternativamente, usar importacao "raw" com wrapping manual para ECDSA P-256
- Corrigir tambem o formato da assinatura ECDSA: Web Crypto retorna assinatura DER, mas VAPID precisa de assinatura raw r||s (64 bytes)

### Tarefa 3: Limpar subscricoes invalidas e re-deploy

- Fazer deploy da edge function corrigida `send-push-notification`
- Testar o envio chamando a funcao via curl para validar que o push chega

## Detalhes Tecnicos

### Formato correto do VAPID JWT signing:

```typescript
// Importar chave privada VAPID (32 bytes raw) como JWK
const privateKeyBytes = urlBase64ToUint8Array(vapidPrivateKey);
const publicKeyBytes = urlBase64ToUint8Array(vapidPublicKey);

// Extrair x e y da chave publica (65 bytes: 0x04 || x[32] || y[32])
const x = uint8ArrayToUrlBase64(publicKeyBytes.slice(1, 33));
const y = uint8ArrayToUrlBase64(publicKeyBytes.slice(33, 65));
const d = uint8ArrayToUrlBase64(privateKeyBytes);

const jwk = { kty: "EC", crv: "P-256", x, y, d, ext: true };
const cryptoKey = await crypto.subtle.importKey(
  "jwk", jwk,
  { name: "ECDSA", namedCurve: "P-256" },
  false, ["sign"]
);

// Assinatura: converter DER para raw r||s
const derSig = new Uint8Array(await crypto.subtle.sign(
  { name: "ECDSA", hash: "SHA-256" }, cryptoKey, data
));
const rawSig = derToRaw(derSig); // extrair r(32) || s(32)
```

### Componente unificado - logica de fluxo:

```text
1. Verificar se ja esta instalado (standalone) ou ja foi dismissado -> nao mostrar
2. Verificar plataforma:
   a. iOS: Mostrar banner "Instale o app" com guia Safari
   b. Android/Desktop: Mostrar banner "Ative notificacoes"
      -> Ao aceitar: requestPermission() + pushManager.subscribe() + salvar no backend
3. Salvar estado no localStorage para nao repetir
```

