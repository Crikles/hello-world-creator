

# Corrigir icone do atalho PWA (JL Transportes)

## Problema

O arquivo `manifest.json` usa `/favicon.ico` como icone do atalho nos dispositivos. Esse favicon contem a logo da Magnus Frete, por isso aparece errado quando o usuario instala o app.

## Solucao

### 1. Atualizar `public/manifest.json`

Trocar o icone de `/favicon.ico` para `/logojltransportes.png` (que ja existe no projeto) e adicionar tamanhos para melhor compatibilidade:

```json
{
    "name": "Logistica JL Transportes - Rastreio",
    "short_name": "JL Rastreio",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#020617",
    "theme_color": "#6366f1",
    "icons": [
        {
            "src": "/logojltransportes.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/logojltransportes.png",
            "sizes": "512x512",
            "type": "image/png"
        },
        {
            "src": "/logojltransportes.png",
            "sizes": "any",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ]
}
```

### 2. Atualizar `index.html`

Adicionar o meta tag `apple-touch-icon` para que o iOS tambem use a logo correta na tela inicial:

```html
<link rel="apple-touch-icon" href="/logojltransportes.png" />
```

### Resultado

- Android/Chrome: icone do atalho sera a logo JL Transportes
- iOS/Safari: icone da tela inicial sera a logo JL Transportes
- Nenhuma nova imagem precisa ser criada (ja existe no projeto)

