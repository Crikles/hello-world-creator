# Melhorias na aba Global

## 1. Dias por etapa (igual Postagens)

- Adicionar nova tabela `global_flow_eventos` com: `loja_id`, `step_order` (1..10), `step_key`, `nome_pt`, `delay_horas`, `ativo`.
- Migration faz seed automático das 10 etapas para cada loja existente e via trigger ao criar `global_flow_config`.
- Na aba **Visão Geral** do `Global.tsx`, substituir o preview estático do fluxo por uma lista editável no mesmo padrão visual de Postagens: cada etapa numerada, switch de ativo, input numérico de **dias após último evento**, e botão Salvar no rodapé fixo (junto do custo estimado).
- Defaults sugeridos: 0, 1, 1, 2, 3, 7, 1, 2, 1, 1 dias.

## 2. Bandeiras no seletor de idioma

- Na aba **Origem & Idioma**, manter o `CountryPicker` como está (sem bandeira inline além da existente).
- Nos dois botões de idioma (English / Español), renderizar a bandeira: 🇺🇸 English (US) e 🇪🇸 Español, no mesmo tamanho dos demais ícones.

## 3. Custos no painel admin + override por usuário

- Já existe `AdminValores.tsx` que lê tudo de `system_config`, e `AdminUsuarios.tsx` que aplica `profiles.custom_prices` por usuário. As chaves `custo_global_flow_email`, `custo_global_flow_sms`, `custo_global_flow_confirmacao_email` já estão em `system_config`.
- Adicionar nova categoria em `AdminValores.tsx`: **"Global (Internacional)"** agrupando essas 3 chaves com labels e descrições amigáveis.
- Adicionar essas 3 chaves na lista de preços customizáveis por usuário em `AdminUsuarios.tsx` (mesma UI já existente de `customPricesForm`).
- Atualizar as edge functions `send-global-flow` e `send-payment-confirmation` para, antes de debitar, checar `profiles.custom_prices[chave]` do dono da loja e usar esse valor se existir; senão cair no `system_config`. (Helper `resolveCusto(userId, key, fallback)`.)

## Arquivos

- Migration: criar `global_flow_eventos` + GRANTs + RLS + seed + trigger.
- `src/pages/Global.tsx`: nova seção de etapas editáveis, bandeiras nos botões de idioma.
- `src/pages/admin/AdminValores.tsx`: nova categoria Global.
- `src/pages/admin/AdminUsuarios.tsx`: incluir as 3 chaves no editor de preços por usuário.
- `supabase/functions/send-global-flow/index.ts` e `send-payment-confirmation/index.ts`: ler custom_prices do usuário.

## Fora de escopo

- Editor visual do conteúdo dos emails/SMS globais (segue padrão fixo).
- Mudar o `CountryPicker` (continua com bandeira+nome+código já implementados).
