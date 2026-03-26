

## Análise: Impacto da publicação nos clientes existentes

### Resultado: **Nenhum impacto negativo. Pode publicar com segurança.**

### Por que está tudo ok

1. **Nenhuma referência ao template Expressa deletado** — o ID `...0003` foi completamente removido do código. Nenhum arquivo frontend ou edge function o menciona.

2. **Templates são congelados por envio** — cada envio grava o `postagem_template_id` no momento da criação. Envios em trânsito continuam usando o template que tinham, independente de mudanças na configuração da loja.

3. **O sistema é genérico** — o `advance-shipments`, `rastreio-info`, `send-email` e todas as edge functions leem eventos dinamicamente pelo `template_id` do envio. Não há lógica hardcoded para nenhum template específico.

4. **Clientes com template Padrão ativo** — continuam funcionando normalmente. O Padrão agora tem 6 eventos (sem falha/reenvio), mas envios antigos que usavam o Padrão com 9 eventos já congelaram esse fluxo no `postagem_template_id`.

5. **Novo template Falha na Entrega** — disponível para seleção. Nenhum cliente o tem ativo automaticamente; precisam selecionar manualmente em Postagens.

6. **Nenhum cliente usava o Expressa** — verificado anteriormente que zero lojas tinham `template_ativo_id` apontando para o Expressa.

### Conclusão
Não há necessidade de nenhuma alteração de código. A publicação é segura.

