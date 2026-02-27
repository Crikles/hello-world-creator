

# Alterar mensagem do prompt de instalacao no iPhone

## O que sera feito

Atualizar o texto do banner de instalacao (`InstallAppPrompt.tsx`) para usar a mesma linguagem do prompt de push notifications.

## Alteracoes

**Arquivo: `src/components/InstallAppPrompt.tsx`**

- Titulo: de `"📲 Instalar Atalho"` para `"🔔 Fique por dentro!"`
- Texto descritivo: de `"Adicione à sua tela inicial para acessar rapidamente."` para `"Deseja receber notificações sobre o status dos seus pedidos em tempo real?"`
- Botao de aceitar: de `"Instalar"` para `"Aceitar"`
- Botao de recusar: de `"Depois"` para `"Agora não"`
- Texto de carregamento: de `"Instalando..."` para `"Ativando..."`

Sao apenas alteracoes de texto, sem mudanca de logica ou estilo.

