

## Diagnóstico: pedidos da loja Prime (negociosmilionarios1901@gmail.com)

### Resultado da investigação

Verifiquei a loja **Prime** (`8e2c6a4c-a7b5-491c-aa56-82377ea1d593`) do usuário `negociosmilionarios1901@gmail.com`:

| Métrica | Valor |
|---|---|
| Total de pedidos | 404 |
| Pedidos pagos | 404 |
| **Pedidos pagos órfãos (sem envio)** | **0** |
| Total de envios | 415 |

Cruzei também os 14 clientes visíveis na captura de tela (Simone Neres, Osmar Belmonte, Renata Flores, Fábio Bezerra, Diego Washington, Marcelo Vicente, Gabriel Souza, Calebe Silva Reis, Alan Silva, Ricardo Silva, Rosilene, Marta Alves, Eliane gomes, Wellington Araújo) — **todos os 14 já estão com `envio_id` preenchido** e aparecem no painel de Envios.

### Conclusão

**Nenhuma ação adicional é necessária.** O usuário já foi atendido pelas correções anteriores:

1. **Patch da função `try_create_envio_dedupe`** (qualificação de colunas) — impede que novos pedidos sofram o bug de ambiguidade `42702`.
2. **Recovery em massa de 68 pedidos órfãos** — varreu TODAS as lojas, incluindo a Prime, e sincronizou os pedidos pagos sem envio.

Os pedidos **Pendentes** que aparecem na imagem (Daniel Malaquias, Persio Izaltino, Wendell Fernandes, Heitor Montanha, Calebe duplicado às 13:26) são corretos — pedidos com PIX ainda não pago não geram envio até a confirmação, é o comportamento esperado.

### O que peço para confirmar com o usuário

Se ele insistir que algum pedido específico ainda está faltando no painel:
- Pedir o **nome do cliente** ou **e-mail** do pedido que ele acredita estar ausente
- Vou cruzar individualmente nas tabelas `pedidos` × `envios` × `webhook_logs` para identificar se foi um caso fora do padrão (ex.: webhook nunca chegou da plataforma de checkout)

Sem mudanças em código ou banco para esta solicitação.

