

# Corrigir botoes AUTO, INICIAR PENDENTES e AVANCAR TODOS + Respeitar delays do fluxo

## Problemas identificados

1. **AUTO** -- Quando ativado, dispara todos os eventos sem parar. Nao respeita os delays (dias) configurados no fluxo de postagem.
2. **INICIAR PENDENTES** -- Avanca qualquer envio, deveria apenas iniciar envios com `ultimo_evento_ordem = 0` (pendentes na estaca zero).
3. **AVANCAR TODOS** -- Envia tudo de uma vez sem intervalo. Deveria avancar 1 envio de cada vez com intervalo de 1 minuto entre cada.
4. **Delays do fluxo** -- Os dias setados nos eventos (`delay_horas`) nao sao respeitados. O sistema deveria verificar se ja passou o tempo necessario antes de avancar.

## Arquitetura da solucao

O campo `delay_horas` nos eventos define quantas horas devem passar antes de avancar para aquele evento. Precisamos:

1. Adicionar uma coluna `proximo_avanco_em` (timestamptz) na tabela `envios` para registrar quando o envio pode avancar novamente.
2. Ao avancar um envio, calcular o proximo horario permitido com base no `delay_horas` do proximo evento e gravar em `proximo_avanco_em`.
3. Bloquear o avanco se `now() < proximo_avanco_em`.

## Alteracoes

### 1. Migracao no banco de dados

Adicionar coluna `proximo_avanco_em` na tabela `envios`:

```sql
ALTER TABLE public.envios 
  ADD COLUMN proximo_avanco_em timestamptz;
```

### 2. `src/lib/email-trigger.ts` -- Respeitar delay do fluxo

Antes de avancar, verificar:
- Se o envio tem `proximo_avanco_em` no futuro, retornar null (nao avancar)
- Apos avancar, buscar o proximo evento (o que viria depois) e calcular `proximo_avanco_em = now() + delay_horas do proximo evento`
- Gravar `proximo_avanco_em` junto com a atualizacao de status

```text
// Pseudo-logica adicionada:
if (shipment.proximo_avanco_em && new Date(shipment.proximo_avanco_em) > new Date()) {
    return null;  // Ainda nao pode avancar
}

// Apos avancar para nextEvent, calcular proximo delay:
const followingEvent = allEvents.find(e => e.ordem > nextEvent.ordem);
const proximoAvancoEm = followingEvent 
    ? new Date(Date.now() + followingEvent.delay_horas * 3600000).toISOString()
    : null;

// Salvar junto no update:
.update({ 
    ultimo_evento_ordem: nextEvent.ordem,
    status: newStatus,
    status_label: nextEvent.status_label,
    proximo_avanco_em: proximoAvancoEm
})
```

### 3. `src/pages/Envios.tsx` -- Corrigir os 3 botoes

**AUTO:**
- Ativar listener realtime que detecta novos envios (status pendente, ultimo_evento_ordem = 0)
- Quando detecta um novo, dispara apenas o primeiro evento (iniciar)
- NAO fica em loop avancando todos. Apenas inicia novos pedidos que chegam.

**INICIAR PENDENTES:**
- Filtrar APENAS envios com `ultimo_evento_ordem === 0` (ou null)
- Avancar apenas esses (dar o primeiro passo)

**AVANCAR TODOS:**
- Filtrar envios que nao estao entregues E que ja podem avancar (`proximo_avanco_em` no passado ou null)
- Processar 1 por vez com intervalo de 1 minuto (60 segundos) entre cada
- Mostrar progresso visual (ex: "Avancando 3/15...")
- Permitir cancelar o processo

### 4. Detalhes tecnicos da implementacao

**batchAdvance refatorado:**

```text
// INICIAR PENDENTES
batchAdvance("pendentes") => filtra (e.ultimo_evento_ordem ?? 0) === 0
  -> avanca todos de uma vez (sao apenas inicializacoes)

// AVANCAR TODOS  
batchAdvance("todos") => filtra status !== "entregue" && canAdvanceNow(e)
  -> processa sequencialmente com setTimeout de 60s entre cada
  -> estado: { processing: true, current: 3, total: 15 }
  -> botao mostra "Avancando 3/15..." com opcao de cancelar

// canAdvanceNow verifica:
  -> proximo_avanco_em === null || new Date(proximo_avanco_em) <= new Date()
```

**AUTO refatorado:**

```text
// Quando AUTO esta ativo:
useEffect que escuta insercoes na tabela envios (realtime)
  -> se novo envio com ultimo_evento_ordem = 0
  -> triggerNextEmail(envio.id, loja.id) -- apenas 1 avanco (iniciar)
  -> NAO faz loop
```

## Resultado esperado

- **AUTO**: Apenas inicia automaticamente novos pedidos que chegam. Nao avanca alem do primeiro passo.
- **INICIAR PENDENTES**: So toca em envios na estaca zero. Um clique = todos os pendentes iniciam.
- **AVANCAR TODOS**: Avanca 1 envio por minuto, respeitando os delays configurados no fluxo.
- **Delays**: O campo `delay_horas` de cada evento e respeitado. Se um evento tem delay de 48h (2 dias), o envio so avanca apos 48h terem passado.

