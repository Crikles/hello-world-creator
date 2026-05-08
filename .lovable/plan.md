
## Contexto

A análise mostrou que **os créditos estão sendo debitados corretamente** sempre que o sistema processa um envio. Quando um lojista percebe "pedidos chegando e créditos sem cair", o motivo é sempre uma destas 3 condições que **impedem o envio de avançar** (e por isso, nada é cobrado):

1. **`auto_envio = false`** na configuração da loja → pedidos viram envios mas ficam parados em "pendente" até o lojista clicar manualmente. Ex.: loja "Variedades" do `backupativado@gmail.com` acumula 455 envios parados há semanas.
2. **`filtro_metodo = cartao`** na integração de checkout → todos os PIX pagos são descartados. Ex.: `andretelees@hotmail.com` perdeu 31 PIX pagos nas últimas 48h.
3. **Saldo insuficiente** (< custo do envio) → o cron tenta debitar, falha, e o envio fica preso. Ex.: `rodrigosantos…` com R$ 0,60 e 270 envios travados.

Hoje não existe nenhum lugar único onde admin/lojista veja esses bloqueios — eles só descobrem quando o cliente reclama.

## O que será construído

### 1. Aba "Diagnóstico de Débitos" no painel admin
Nova aba em `/admin/usuarios` (ou nova rota `/admin/diagnostico`) listando, em tempo real, todas as lojas com envios travados nas últimas 72h, classificando o motivo em uma das 3 categorias:

```text
Loja           | Pedidos | Envios travados | Motivo                   | Ação
---------------|---------|-----------------|--------------------------|--------
Variedades     | 455     | 455             | auto_envio desligado     | [Ativar]
Ferra          | 180     | 130             | filtro_metodo = cartão   | [Mudar p/ todos]
yaveh          | 29      | 29              | Saldo R$ 0,60 < R$ 1,50  | [Notificar]
```

Cada linha permite ação direta do admin (ativar auto_envio, mudar filtro, ou disparar alerta WhatsApp/email).

### 2. Reforço do `low-balance-alert`
Hoje só dispara dentro de `advance-shipments`. Vamos:
- Estender para também alertar quando saldo < custo médio do envio da loja (preventivo).
- Aumentar canais: já manda email, adicionar WhatsApp via UAZAPI usando o número verificado.
- Reduzir throttle de 24h → 12h para casos de saldo crítico (< 1 moeda).

### 3. Banner de aviso no app do lojista
No topo do `Dashboard` e da página `Envios`, mostrar um banner vermelho quando:
- `postagem_config.auto_envio = false` E existem envios pendentes em ordem 0 há mais de 1h, OU
- `creditos.saldo` < custo médio do último envio processado, OU
- `checkout_integrations.filtro_metodo` ≠ "todos" E houve descartes nas últimas 24h.

Texto do banner explica exatamente o que fazer (ex.: "Você tem 32 pedidos PIX que não geraram envios porque seu filtro está em 'cartão'. [Mudar para 'todos']").

### 4. Backfill opcional dos envios travados (não destrutivo)
Botão admin em cada linha do diagnóstico: "Tentar processar agora" — chama `advance-shipments` com `targetEnvioId` para cada envio parado. Não altera dados antigos automaticamente; só atua sob comando.

## Detalhes técnicos

- **Nova RPC `get_admin_debit_diagnostics()`** (SECURITY DEFINER, restrita a admin): retorna por loja `{loja_id, user_id, email, motivo, envios_travados, ultima_atividade}` agregando `postagem_config`, `checkout_integrations`, `creditos.saldo`, `envios` (ordem 0, deleted_at null, > 1h).
- **Frontend admin**: novo componente `DiagnosticoDebitos.tsx` montado como aba em `AdminUsuarios.tsx`, com `useQuery` + `refetchInterval: 30s`.
- **Banner do lojista**: novo componente `BloqueioCobrancaBanner.tsx` em `src/components/`, consultando uma RPC mais leve `get_my_debit_blocks()` filtrada por `user_id = auth.uid()`.
- **`low-balance-alert`**: adicionar parâmetro `severity: 'critical' | 'warning'` e branch para WhatsApp.
- Nenhuma alteração na lógica de débito em si — `advance-shipments`, `send-payment-confirmation`, `send-recovery-email`, `send-whatsapp` continuam funcionando como hoje (validado via SQL: 100% dos envios processados nas últimas 48h tiveram débito correspondente).

## Fora de escopo
- Não vamos forçar `auto_envio = true` em massa (lojistas escolheram manual deliberadamente em alguns casos).
- Não vamos apagar/cancelar os envios travados (você pediu para deixá-los).
- Não vamos refatorar `debit_user_credits` — está atômica e correta.
