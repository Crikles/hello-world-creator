

# Adicionar caractere invisível no short_name do manifest

## Alteração

Atualizar `public/manifest.json`:
- `"short_name": "JL Rastreio"` → `"short_name": "ㅤ"`

Isso fará com que o campo "From..." nas notificações push apareça praticamente em branco/invisível tanto no iOS quanto no Android.

## Efeitos colaterais

- O nome do app na tela inicial do celular (embaixo do ícone) também ficará invisível/em branco
- Em alguns dispositivos Android, o sistema pode usar o campo `name` como fallback, mostrando "Logística JL Transportes - Rastreio"

## Arquivo modificado

**public/manifest.json** — Trocar o valor de `short_name` para o caractere invisível Hangul Filler (U+3164)

