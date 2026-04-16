
Objetivo: corrigir a falsa impressão de que o botão não processou nada e dar garantia visual/técnica de que o reenvio está em andamento ou já concluiu.

Diagnóstico encontrado:
- O backend foi acionado: há log recente de `retry-failed-sends` com `Aceito em background: lojas=1 pendentes=128`.
- O problema principal está no painel:
  - o botão soma `128` linhas históricas de falha por saldo;
  - o placar marca `65` clientes como pendentes se existiu qualquer falha antiga no grupo;
  - quando o reenvio dá certo, as linhas antigas de falha continuam no histórico, então o frontend continua contando como pendente.
- Na leitura do banco, o status mais recente por `pedido + tipo` já está majoritariamente/sobretudo em `sent`; então a UI está olhando o histórico bruto, não o estado atual.
- Há ainda um ponto de confiança: o “lock” atual é só em memória da função, então não é a forma mais forte de evitar clique duplo entre execuções/instâncias.

Plano de correção:
1. Corrigir a regra do Histórico
- Recalcular placar e tabela usando o último log por `pedido_id + tipo` (`email`/`sms`), não “qualquer falha que já existiu”.
- O botão “Reenviar X falhas” também deve usar apenas falhas ainda pendentes no estado mais recente.
- Resultado esperado: depois que o reenvio gerar `sent`, o placar cai imediatamente e o botão deixa de mostrar falhas já resolvidas.

2. Mostrar progresso real no frontend
- Trocar o estado atual do botão por status explícitos:
  - “Iniciando reenvio…”
  - “Processando X pendências…”
  - “Concluído”
- Exibir um aviso/badge no Histórico enquanto houver reprocessamento em andamento.
- Invalidar/refazer as queries logo após aceitar o job e ao receber mudanças do histórico.

3. Garantir atualização em tempo real de verdade
- Validar/ativar realtime da tabela `confirmacao_pagamento_log` no backend.
- Manter o fallback de polling, mas usar realtime para refletir a conclusão assim que novos `sent/failed` forem gravados.
- Se necessário, também reagir a mudanças na fila WhatsApp para manter a percepção consistente.

4. Fortalecer a proteção contra clique duplo
- Substituir a trava só em memória por uma trava persistente no banco para o reenvio por loja.
- Salvar um registro de execução com status (`queued`, `running`, `done`, `error`) e janela de expiração.
- Antes de iniciar novo reenvio, verificar se já existe execução ativa para a loja.
- Isso dá garantia melhor contra gasto duplo, inclusive com refresh ou múltiplas instâncias.

5. Melhorar o retorno da função de reenvio
- Fazer `retry-failed-sends` devolver mais contexto:
  - quantos itens ainda estão realmente pendentes;
  - id/status da execução;
  - mensagem “já existe processamento em andamento” baseada em trava persistente.
- O frontend passa a exibir esse status ao invés de depender só de contagens históricas.

Validação após implementar:
- Clicar 1x no botão com pendências reais.
- Confirmar que o botão muda para estado de processamento.
- Confirmar que o placar reduz conforme entram logs `sent`.
- Confirmar que o botão para de mostrar falhas resolvidas.
- Confirmar que um segundo clique durante execução não cria novo processamento nem novo débito.

Detalhes técnicos:
- Arquivo principal do bug visual: `src/pages/ConfirmacaoPagamento.tsx`
- Função principal do reprocessamento: `supabase/functions/retry-failed-sends/index.ts`
- A lógica correta deve deduplicar por estado mais recente de `confirmacao_pagamento_log`, provavelmente com:
  - frontend: agrupamento por `pedido_id + tipo` escolhendo o log mais recente;
  - ou backend/RPC/view para devolver um resumo já consolidado.
- Para a garantia forte de idempotência, será necessária migração criando uma tabela de execuções/travas do reenvio com RLS apropriada para leitura do lojista e escrita via backend.

Resultado esperado final:
- o usuário clica uma vez;
- vê que o processo foi aceito e está rodando;
- os números mudam conforme os envios são concluídos;
- falhas antigas já resolvidas deixam de aparecer como pendentes;
- e não há risco prático de reenviar/cobrar duas vezes por clique repetido.