Plano para corrigir o fluxo automático após o start manual/automático:

1. Corrigir a regra da automação
- Hoje a rotina automática só continua avançando pedidos se o botão AUTO estiver ligado na loja.
- Isso faz pedidos iniciados manualmente ficarem parados por dias, mesmo com o próximo avanço vencido.
- Vou ajustar para que:
  - AUTO ligado: inicia pedidos pendentes automaticamente e continua o fluxo.
  - AUTO desligado: não inicia novos pendentes sozinho, mas continua automaticamente os pedidos que já foram iniciados manualmente.

2. Preservar as pausas manuais corretas
- Manter paradas obrigatórias para etapas como pagamento/taxação/falha de entrega e entrega final quando exigirem ação manual.
- Não alterar os dias configurados em Postagens; a rotina vai respeitar exatamente o delay de cada etapa.

3. Reprocessar o acúmulo travado
- Depois da correção, executar a rotina para avançar os pedidos já vencidos que ficaram parados em Coletado/Postado/Em trânsito/etc.
- O processamento continuará em lotes para evitar falhas por limite de envio.

4. Validar
- Conferir se pedidos com `próximo avanço` vencido estão saindo da etapa atual.
- Conferir logs recentes de e-mail para garantir que os disparos voltaram a acompanhar cada avanço.
- Confirmar que pedidos pendentes em ordem zero continuam não iniciando sozinhos quando AUTO estiver desligado.