
# Cooldown de 2 Minutos no Botao "Avançar Acao"

## Objetivo
Adicionar um limite de 2 minutos entre cada clique nos botoes de avançar (individual e em lote), evitando sobrecarga nos envios de e-mail e SMS.

## O que sera feito

### Arquivo: `src/pages/Envios.tsx`

1. **Estado de cooldown por envio**: Criar um state `cooldowns` (Record de envioId para timestamp de quando o cooldown expira) para controlar o botao individual de avançar de cada envio.

2. **Estado de cooldown global para batch**: Criar um state `batchCooldown` (timestamp) para controlar os botoes "Iniciar Pendentes" e "Avançar Todos".

3. **Timer de atualizacao**: Usar um `useEffect` com `setInterval` de 1 segundo para forcar re-render e atualizar o estado visual dos botoes (countdown visivel).

4. **Apos avançar com sucesso (individual)**: Registrar `Date.now() + 120000` (2 min) no `cooldowns` para aquele envio. O botao ficara desabilitado e mostrara o tempo restante.

5. **Apos avançar em lote**: Registrar cooldown global de 2 min. Os botoes "Iniciar Pendentes" e "Avançar Todos" ficarao desabilitados com countdown.

6. **Feedback visual**: Botoes desabilitados mostrarao o tempo restante em formato `Xm Xs` enquanto estiverem em cooldown.

### Detalhes tecnicos

- O cooldown e puramente client-side (estado React), sem necessidade de alteracoes no banco de dados
- O `advanceMutation.onSuccess` setara o cooldown para o envio especifico
- O `batchAdvance` setara o cooldown global apos completar
- Os botoes verificam `cooldowns[envio.id] > Date.now()` ou `batchCooldown > Date.now()` para decidir se ficam desabilitados
- Um `setInterval` a cada segundo garante que o countdown visual atualize em tempo real
