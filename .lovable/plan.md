## Objetivo

Substituir os assuntos atuais dos emails (que estão muito simples e curtos, como "Quase aí!", "Atualização do trajeto", "Em redistribuição") por assuntos **claros, diretos e profissionais**, sem usar `{{produto}}`, em todos os templates de sistema (Envio Rápido, Envio com Falha na Entrega, Envio com Taxação, Envio Prolongado).

## Como vai ficar

Mapa de novos assuntos por `status_label`:

```text
Postado                                         → 📦 Seu pedido foi postado
NF-e                                            → 🧾 Sua nota fiscal já está disponível
Coletado                                        → 🚚 Pedido coletado pela transportadora
Em Trânsito                                     → 🛣️ Seu pedido está em trânsito
Em trânsito internacional                       → 🌎 Pedido em trânsito internacional
Chegou ao Brasil                                → 🇧🇷 Seu pedido chegou ao Brasil
Retido na alfândega — pagamento necessário      → ⚠️ Pedido retido na alfândega — ação necessária
Pagamento da taxa confirmado                    → ✅ Pagamento da taxa confirmado
Liberado pela alfândega                         → 🛃 Liberado pela alfândega
Passando por centro de triagem                  → 🛣️ Atualização do trajeto do seu pedido
Em redistribuição                               → 🔄 Pedido em redistribuição
Retornou ao centro de distribuição              → 📍 Entrega remarcada — pedido a caminho
Chegou ao estado vizinho                        → 📍 Seu pedido está perto da região de entrega
Chegou perto de você                            → 📍 Seu pedido chegou perto de você
Centro de Distribuição                          → 🏢 Pedido no centro de distribuição
Chegou no centro local                          → 🏢 Pedido no centro local
Entrega reprogramada                            → 📅 Entrega reprogramada
Saiu para entrega                               → 🛵 Seu pedido saiu para entrega
Em rota                                         → 🛵 Pedido em rota de entrega
Em rota final                                   → 🛵 Saiu para a entrega final
Entregue ✅                                     → ✅ Pedido entregue com sucesso
Falha na entrega — pagar reenvio                → ⚠️ Falha na entrega — pagamento do reenvio
Reenvio pago                                    → ✅ Reenvio confirmado — pedido a caminho
```

Características do novo padrão:
- Tom claro, direto e profissional (não infantil)
- Sem `{{produto}}` — assunto curto e legível na caixa de entrada
- Um emoji semântico no início para ajudar o scan visual
- Consistência entre os 4 templates de sistema (mesmo status_label → mesmo assunto)

## Implementação técnica

1. **Migration SQL única** atualizando `public.postagem_eventos`:
   - `UPDATE` por `status_label`, restrito a eventos cujo `template_id` pertença a `postagem_templates` com `is_system = true`
   - Não toca em eventos personalizados (lojas que já editaram o assunto continuam com o texto delas, pois `is_system = false` no template clonado)

2. **Atualizar `src/components/postagens/emailTemplates.ts`**:
   - Adicionar um `defaultSubjectByEvent: Record<string, string>` com os mesmos textos acima
   - Em `EmailEditor.tsx` (linhas 69 e 124), trocar o fallback `${eventoNome} - {{produto}}` por `defaultSubjectByEvent[eventKey] ?? eventoNome` — assim o preview e o "Restaurar padrão" também refletem o novo padrão

3. Nenhuma mudança em edge functions: `send-email` já lê `assunto_email` da tabela e a substituição de variáveis continua funcionando (sem `{{produto}}` o subject só não tem nada para substituir).

## Fora de escopo

- Não altera assuntos já personalizados por lojas (eventos com `is_system = false`)
- Não altera assuntos de recovery (`recovery_config`) nem de confirmação de pagamento
- Não muda o corpo dos emails — só o assunto que aparece na caixa de entrada
