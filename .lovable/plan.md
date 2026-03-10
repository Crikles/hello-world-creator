

# Bug: Envios antigos mudam de JL para JADLOG

## Causa raiz

Linha 80-81 de `Envios.tsx`:
```typescript
const isJadlog = useCallback((envio) => {
  return envio.transportadora?.toUpperCase().includes('JADLOG') 
    || (!envio.transportadora && loja?.logistica_provider === 'jadlog');
}, [loja?.logistica_provider]);
```

Quando o envio **não tem** `transportadora` preenchida (campo null — comum em envios antigos ou criados por webhooks), o sistema usa o `logistica_provider` **atual** da loja como fallback. Quando o usuário muda de JL para JADLOG nas configurações, **todos** os envios antigos sem transportadora passam a mostrar badge JADLOG e links para o domínio errado.

## Solução

Alterar o fallback para usar o **sufixo do código de rastreio** ao invés do provider atual da loja. Envios JL terminam em `JL`, envios JADLOG terminam em `JD`. Isso é imutável e gravado no momento da criação.

### `src/pages/Envios.tsx` — linha 80-82

Antes:
```typescript
const isJadlog = useCallback((envio) => {
  return envio.transportadora?.toUpperCase().includes('JADLOG') 
    || (!envio.transportadora && loja?.logistica_provider === 'jadlog');
}, [loja?.logistica_provider]);
```

Depois:
```typescript
const isJadlog = useCallback((envio: { transportadora?: string | null; codigo_rastreio?: string | null }) => {
  if (envio.transportadora) {
    return envio.transportadora.toUpperCase().includes('JADLOG');
  }
  // Fallback: check tracking code suffix (JD = JADLOG, JL = JL Transportes)
  if (envio.codigo_rastreio) {
    return envio.codigo_rastreio.toUpperCase().endsWith('JD');
  }
  return false;
}, []);
```

Remove a dependência de `loja?.logistica_provider`, fazendo com que o badge e o domínio de rastreio reflitam a transportadora **real** usada na criação do envio, não a configuração atual da loja.

Mesma lógica deve ser verificada em outros locais que usam `isJadlog` ou fallback similar (edge functions `send-email`, `advance-shipments`, `rastreio-info`). As edge functions já usam `envio.transportadora` diretamente, então estão corretas. A correção é apenas no frontend.

