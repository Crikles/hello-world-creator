## Diagnóstico

Não é bug de save dos usuários — é limitação de RLS para o admin.

Quando você usa **"Login As"**, o frontend troca o `user` exibido, mas o **JWT continua sendo o seu (admin)**. Logo, `auth.uid()` no banco é sempre o seu id. As políticas RLS das tabelas de configuração da loja exigem `user_owns_loja(auth.uid(), loja_id)` — como você não é dono da loja do cliente, o banco retorna **0 linhas** (parece "desconfigurado") e bloqueia o save.

Já existe esse padrão de exceção para admin em `confirmacao_pagamento_config`, `envios`, `lojas` e `leads`. Falta replicar nas demais tabelas de configuração/dados da loja.

## Tabelas sem policy de admin (causa do problema)

| Tabela | Sintoma para o admin |
|---|---|
| `empresas` | Dados da Empresa aparecem vazios e não salvam |
| `postagem_config` | Config de Postagens aparece padrão e não salva |
| `postagem_templates` (loja_id NOT NULL) | Templates customizados da loja invisíveis |
| `postagem_eventos` (loja_id NOT NULL) | Eventos customizados da loja invisíveis (SELECT só permite system ou owner) |
| `checkout_integrations` | Integrações de checkout vazias |
| `recovery_config` | Config de Recuperação vazia |
| `upsell_config` | Config de Upsell vazia |
| `pedidos` | Lista de pedidos vazia |

## Plano

Criar **uma migration** adicionando policy `FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (...)` em cada tabela acima — mesmo padrão já aprovado em `confirmacao_pagamento_config`.

Para `postagem_eventos`, ajustar também o SELECT existente para incluir admin (`loja_id IS NULL OR user_owns_loja(...) OR has_role(...,'admin')`).

Nada muda no frontend e nada muda para usuários finais — apenas admins ganham leitura/escrita global nessas tabelas, igual já têm em `lojas`, `envios`, `leads` e `confirmacao_pagamento_config`.

## Detalhes técnicos

```sql
-- exemplo (repetido para cada tabela)
CREATE POLICY "Admins manage all empresas"
  ON public.empresas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
```

Tabelas afetadas: `empresas`, `postagem_config`, `postagem_templates`, `checkout_integrations`, `recovery_config`, `upsell_config`, `pedidos` + ajuste de SELECT em `postagem_eventos`.

Sem alterações de schema, sem alterações de dados, sem alterações de código frontend/edge functions.