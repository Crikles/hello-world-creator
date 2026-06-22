## Objetivo

Para envios internacionais (fluxo global), exibir o status sempre no idioma do template (inglês ou espanhol, conforme `envio.global_flow_lang`) — tanto na **lista de envios** ao lado do `0/10` quanto no **filtro de status** do topo.

## Estado atual

- `src/pages/Envios.tsx`:
  - `statusLabels` e `statusOptions` só têm rótulos em português (Pendente, Em Trânsito, Coletado, etc.).
  - `getDisplayStatus(envio)` retorna `envio.status_label` (PT) ou o mapa em português do enum interno.
  - Resultado: envio internacional aparece como **"Em Trânsito"** / **"Coletado"** em vez de **"In International Transit"** / **"Shipped by Sender"**.
- Backend `advance-shipments → advanceGlobalFlowShipment` **não grava** `status_label`. O texto em português que aparece hoje veio do wizard de criação ou de avanço manual nacional.

## Mudanças

### 1) Frontend — `src/pages/Envios.tsx`

a) Constantes novas com os 10 status do fluxo global (mesmos nomes de `seed_global_flow_eventos.nome_en/nome_es` e de `global_flow_system_templates.status_label`):

```ts
const GLOBAL_STEPS_EN = [
  "Order Received","Order Prepared","Shipped by Sender","Left Country of Origin",
  "In International Transit","Arrived at Destination Country","In Customs Processing",
  "In Local Transit","Out for Delivery","Delivered"
];
const GLOBAL_STEPS_ES = [
  "Pedido Recibido","Pedido Preparado","Enviado por el Remitente","Salió del País de Origen",
  "En Tránsito Internacional","Llegó al País de Destino","En Procesamiento Aduanero",
  "En Tránsito Local","Salió para Entrega","Entregado"
];
```

b) `getDisplayStatus(envio)`: se `envio.is_international`, retornar `GLOBAL_STEPS_xx[ultimo_evento_ordem - 1]` (em inglês por padrão, espanhol se `global_flow_lang === 'es'`). Para `ultimo_evento_ordem = 0`, mostrar **"Pending"** / **"Pendiente"**.

c) `statusOptions`: adicionar grupo **"Global (International)"** com os 10 itens em inglês, cujo `value` seja o próprio texto em inglês (será usado como `status_label` no filtro do backend).

d) `statusColors`: cobrir os novos labels EN/ES reusando as mesmas classes semânticas já existentes (em trânsito → accent; out for delivery → primary; delivered → primary/15).

### 2) Backend — gravar `status_label` em inglês a cada avanço global

`supabase/functions/advance-shipments/index.ts → advanceGlobalFlowShipment`:

- Adicionar mapa `GLOBAL_LABELS_EN` (mesmo array de 10 nomes).
- No `update` do envio, incluir `status_label: GLOBAL_LABELS_EN[nextStep - 1]` (sempre em inglês para indexar/filtrar no banco — UI traduz para ES quando preciso).

Deploy de `advance-shipments`.

### 3) Backfill — alinhar envios internacionais existentes

Migration única:

```sql
UPDATE public.envios SET status_label = CASE ultimo_evento_ordem
  WHEN 1 THEN 'Order Received'
  WHEN 2 THEN 'Order Prepared'
  WHEN 3 THEN 'Shipped by Sender'
  WHEN 4 THEN 'Left Country of Origin'
  WHEN 5 THEN 'In International Transit'
  WHEN 6 THEN 'Arrived at Destination Country'
  WHEN 7 THEN 'In Customs Processing'
  WHEN 8 THEN 'In Local Transit'
  WHEN 9 THEN 'Out for Delivery'
  WHEN 10 THEN 'Delivered'
END
WHERE is_international = true
  AND deleted_at IS NULL
  AND ultimo_evento_ordem BETWEEN 1 AND 10;
```

## Validação

1. Na lista de envios em `/loja/.../envios`, um envio internacional no step 3 mostra **"Shipped by Sender"** e o badge `3/10`.
2. Filtro de status passa a ter um grupo **"Global (International)"** com 10 opções em inglês; selecionar "In International Transit" filtra apenas envios internacionais nesse step.
3. Envios nacionais continuam exibindo "Em Trânsito", "Coletado", etc., sem regressão.
4. Próximo avanço global escreve `status_label` em inglês automaticamente.
