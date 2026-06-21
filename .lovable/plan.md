## Objetivo

Refazer a página **Fluxo Global** com o mesmo padrão visual e estrutural da aba **Postagens** (hero + tabs + cards glass com glow-border + barra de custo). Adicionar país de origem do pedido, separar os 4 toggles de canais (com custo individual), remover qualquer menção a NF-e, e mostrar custo total estimado por pedido.

## Estrutura da página (replicando padrão Postagens)

```
<Hero: "Fluxo Global" + descrição>
<Tabs>
  ├─ Visão Geral
  ├─ Origem & Idioma
  └─ Canais & Custos
</Tabs>
<Barra fixa inferior com "Custo estimado por pedido" + botão Salvar>
```

### Tab 1 — Visão Geral

- **Card "Status"** grande com Switch ATIVAR/DESATIVAR + badge (ATIVO em verde / DESATIVADO em cinza)
- **Card "Como funciona"** (3 colunas com ícones): Detecção automática internacional · Idioma travado no envio · Sem edição de template
- **Card "Pré-visualização do fluxo"** — timeline vertical das 10 etapas no idioma escolhido, com ícones e linha conectora (visual rico tipo stepper)

### Tab 2 — Origem & Idioma

- **Card "País de origem do pedido"**: dropdown searchable (shadcn `Command`) com bandeira + nome + código. Países sugeridos no topo: 🇨🇳 China, 🇺🇸 United States, 🇪🇸 Spain, 🇲🇽 Mexico, 🇩🇪 Germany, 🇮🇹 Italy. Lista completa (~50). Esse país aparece como remetente nos emails ("Shipped from China").
- **Card "Idioma das mensagens"**: 2 botões grandes lado a lado (🇺🇸 English US / 🇪🇸 Español) — estilo do seletor Atlas/JetLine atual em Postagens.

### Tab 3 — Canais & Custos

Lista de 4 cards (mesmo layout dos `featureToggles` de Postagens):

| Canal | Ícone | Custo |
| --- | --- | --- |
| Email de Rastreio (10 etapas) | Mail | `custo_email_rastreio` × 10 |
| SMS de Rastreio (10 etapas) | MessageSquare | `custo_sms_rastreio` × 10 |
| Email de Confirmação de Pagamento | BadgeCheck | `custo_confirmacao_email` × 1 |
| SMS de Confirmação de Pagamento | MessageCircle | `custo_confirmacao_sms` × 1 |

Cada card:
- Ícone à esquerda em pílula com `bg-primary/10`
- Título + descrição curta
- Badge de custo unitário à direita (ex: `1 moeda/email`)
- Switch grande à direita

NF-e **não aparece em lugar nenhum** (Global não emite nota).

### Barra inferior fixa (igual Postagens)

- À esquerda: **"Custo estimado por pedido"** com soma dos canais ativos (em moedas). Ex: `21,12 moedas/pedido`
- À direita: botão **Salvar alterações** (desabilitado quando não há mudanças)

## Backend — alterações de schema

Adicionar colunas em `global_flow_config`:

| coluna | tipo | default |
| --- | --- | --- |
| `pais_origem` | text | `'CN'` |
| `pais_origem_nome` | text | `'China'` |
| `confirmacao_email` | boolean | true |
| `confirmacao_sms` | boolean | false |

(`enviar_email` e `enviar_sms` existentes passam a representar **rastreio**; renomear conceitualmente, mas manter nomes no DB para evitar migração de dados.)

## Edge function — ajustes em `send-global-flow`

- Ler `pais_origem_nome` da config e injetar no header do email ("Shipped from {país}").
- Continuar usando os mesmos custos atuais (`custo_email_rastreio`, `custo_sms_rastreio`).

## Confirmação de pagamento internacional

Branch dentro de `send-payment-confirmation`:
- Se `global_flow_config.ativo` + envio é internacional → usa template hardcoded de "Payment Confirmed" / "Pago confirmado" no idioma da config, com o país de origem.
- Respeita os toggles `confirmacao_email` / `confirmacao_sms` da `global_flow_config` (não os toggles da `confirmacao_pagamento_config`).
- Custos: `custo_confirmacao_email` / `custo_confirmacao_sms` (já existem).

## Lista de países (constante no front)

Array com ~50 países (foco em rotas dropshipping/internacional): China, EUA, Espanha, México, Alemanha, Itália, França, Portugal, Reino Unido, Argentina, Chile, Colombia, Peru, Canadá, Japão, Coreia do Sul, Vietnã, Tailândia, Índia, Turquia, Emirados Árabes, Polônia, Holanda, Bélgica, Suécia, Suíça, Áustria, etc. Com `{ code, name_pt, name_en, name_es, flag }`.

## Arquivos a editar / criar

**Editar**
- `src/pages/Global.tsx` — refazer 100% no padrão Postagens (Tabs + barra inferior + cards glass)
- `supabase/functions/send-global-flow/index.ts` — usar `pais_origem_nome` no header
- `supabase/functions/send-payment-confirmation/index.ts` — branch internacional

**Criar**
- `src/lib/countries.ts` — lista de países com bandeiras/nomes localizados
- Migration: colunas `pais_origem`, `pais_origem_nome`, `confirmacao_email`, `confirmacao_sms` em `global_flow_config`

## Fora de escopo

- Editor de conteúdo dos templates (continua 100% padrão)
- WhatsApp no Global
- Detecção automática `is_international` em webhooks (próxima etapa)
- Site público de rastreio global (outro projeto)
