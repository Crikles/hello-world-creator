

# Corrigir Criptografia do Web Push (send-push-notification)

## Problema identificado

A edge function `send-push-notification` envia o payload como texto puro (JSON string) mas declara o header `Content-Encoding: aes128gcm`. O Web Push Protocol (RFC 8291) exige que o payload seja criptografado usando:

1. ECDH key agreement com a chave p256dh do assinante
2. HKDF para derivacao de chaves
3. Criptografia AES-128-GCM

Sem essa criptografia, o servidor push (FCM/Mozilla) rejeita a mensagem, resultando em falha.

## Solucao

Reescrever a funcao `sendWebPush` em `supabase/functions/send-push-notification/index.ts` para implementar a criptografia RFC 8291 usando a Web Crypto API nativa do Deno.

### Alteracoes no arquivo `supabase/functions/send-push-notification/index.ts`

1. **Adicionar funcao de criptografia `encryptPayload`** que implementa:
   - Gerar par de chaves ECDH efemeras (P-256)
   - Computar shared secret via ECDH com a chave p256dh do assinante
   - Derivar chaves usando HKDF (salt, IKM, PRK, CEK, nonce) conforme RFC 8291
   - Criptografar com AES-128-GCM
   - Montar o record conforme o formato aes128gcm (salt + rs + keyid_len + keyid + ciphertext)

2. **Atualizar funcao `sendWebPush`** para:
   - Receber as chaves do assinante (p256dh, auth)
   - Chamar `encryptPayload` antes de enviar
   - Usar o payload criptografado no body da requisicao
   - Manter o header `Content-Encoding: aes128gcm`

3. **Atualizar a chamada da funcao** no loop principal para passar as chaves do assinante

### Detalhes tecnicos da criptografia (RFC 8291 + RFC 8188)

```text
+------------------+
| Subscriber keys  |  p256dh (ECDH public key)
| (from browser)   |  auth (16-byte secret)
+------------------+
         |
         v
+------------------+
| ECDH Agreement   |  local ephemeral key + subscriber p256dh
+------------------+  => shared_secret (32 bytes)
         |
         v
+------------------+
| HKDF Derivation  |  auth_secret + shared_secret + info
+------------------+  => IKM => PRK => CEK (16b) + Nonce (12b)
         |
         v
+------------------+
| AES-128-GCM      |  encrypt(plaintext + padding, CEK, Nonce)
+------------------+  => ciphertext + tag
         |
         v
+------------------+
| aes128gcm record |  salt(16) + rs(4) + keyid_len(1) + keyid(65) + ciphertext
+------------------+
```

### Nenhuma outra alteracao necessaria

- O service worker (`public/sw.js`) ja esta correto
- O componente `PushNotificationPrompt` ja esta correto
- A funcao `save-push-subscription` ja esta correta
- As tabelas e RLS ja estao configuradas

## Sequencia

1. Reescrever `supabase/functions/send-push-notification/index.ts` com a criptografia
2. Deploy da edge function
3. Testar enviando uma notificacao pelo painel admin

