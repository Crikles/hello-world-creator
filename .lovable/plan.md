

# Push Notification com branding dinâmico por domínio

## O que será feito

Adaptar o `PushNotificationPrompt` para usar a paleta vermelha JADLOG (#D71920) quando acessado pelo domínio `rastreio.centrojadlog.com`, mantendo o estilo roxo/indigo atual para o domínio JL.

## Implementação

### Arquivo: `src/components/PushNotificationPrompt.tsx`

1. Importar `isJadlogDomain` de `@/lib/domain-config`
2. Detectar domínio no componente e adicionar classe CSS condicional (`jadlog` ou não) no banner
3. Duplicar os estilos de cor nos CSS inline para a variante `.jadlog`:

| Elemento | JL (atual) | JADLOG |
|----------|-----------|--------|
| Icon wrapper gradient | `#6366f1 → #8b5cf6` | `#D71920 → #8B0F14` |
| Botão "Ativar" | `#6366f1 → #8b5cf6` | `#D71920 → #B7151B` |
| Border do banner | `rgba(99,102,241,0.3)` | `rgba(215,25,32,0.3)` |
| Box-shadow glow | `rgba(99,102,241,...)` | `rgba(215,25,32,...)` |
| Pulse animation | `rgba(99,102,241,0.4)` | `rgba(215,25,32,0.4)` |
| Hover shadow | `rgba(99,102,241,0.4)` | `rgba(215,25,32,0.4)` |

O texto "Ativar" e "Agora não" permanece igual. Apenas cores mudam.

