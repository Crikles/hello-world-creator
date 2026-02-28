

# Botao "Forcar Avanco" individual por envio

## Resumo
Adicionar um botao de "Forcar Avanco" em cada envio que ignora o delay do evento atual (`proximo_avanco_em`), mas ainda calcula e define o delay correto para o proximo evento futuro.

## Alteracoes

### 1. `src/lib/email-trigger.ts`
- Adicionar um novo parametro `forceAdvance: boolean = false` na funcao `triggerNextEmail`
- Na verificacao de delay (linhas 32-36), se `forceAdvance` for `true`, pular o bloqueio por `proximo_avanco_em`
- O calculo de `proximoAvancoEm` para o evento seguinte (linhas 166-169) permanece inalterado, garantindo que o proximo evento respeite seu delay normalmente

### 2. `src/pages/Envios.tsx`
- Criar uma nova mutation `forceAdvanceMutation` que chama `triggerNextEmail(envioId, loja.id, false, true)` (com `forceAdvance = true`)
- No botao de avanco individual de cada envio, quando `canAdvanceNow(e)` retornar `false` (delay ainda ativo), exibir um botao alternativo com icone diferente (ex: `Zap`) e titulo "Forcar Avanco" que usa a mutation de forca
- O botao normal de avanco (FastForward) continua funcionando quando o delay ja expirou

## Detalhes Tecnicos

**Assinatura atualizada:**
```text
triggerNextEmail(envioId, lojaId, forceSendEmail = false, forceAdvance = false)
```

**Logica de skip do delay:**
```text
// Linha 32-36 atualizada:
if (!forceAdvance && proximoAvanco && new Date(proximoAvanco) > new Date()) {
  return null;  // bloqueado pelo delay
}
```

**UI - botao condicional por envio:**
- Se `canAdvanceNow(e)` = true: mostra botao normal (FastForward)
- Se `canAdvanceNow(e)` = false E envio nao esta entregue: mostra botao "Forcar" (Zap) com cor de destaque (amarelo/warning)
- Os botoes "Avancar Todos" e "Iniciar Pendentes" continuam respeitando o delay normalmente
