## Objetivo

Criar uma nova aba **Tutorial** no painel da loja, com cards bem explicados (passo a passo, mastigado) cobrindo TODAS as funcionalidades disponíveis no menu lateral. O usuário poderá clicar em cada card para abrir um detalhamento completo (modal) com instruções, dicas e cuidados.

## Onde fica

- Nova entrada no sidebar, na seção **Sistema**, com ícone `GraduationCap` (lucide):  
  `Tutorial` → `/loja/:lojaId/tutorial`
- Nova rota em `src/App.tsx` apontando para `pages/Tutorial.tsx`.

## Estrutura da página `/tutorial`

Layout:

```text
┌──────────────────────────────────────────────┐
│ Header: "Central de Tutoriais"               │
│ Subtítulo + barra de busca (filtra cards)    │
├──────────────────────────────────────────────┤
│ Filtro por categoria (chips):                │
│ [Todos] [Operações] [Financeiro] [Negócio]   │
│ [Sistema] [Primeiros Passos]                 │
├──────────────────────────────────────────────┤
│ Grid de cards (3 colunas desktop / 1 mobile) │
│ Cada card: ícone, título, resumo curto,      │
│ badge da categoria, botão "Ver detalhes"     │
└──────────────────────────────────────────────┘
```

Ao clicar em **Ver detalhes**, abre um `Dialog` com o conteúdo completo do tutorial daquela funcionalidade (passo a passo numerado, dicas, avisos importantes).

## Cards (cobertura completa)

**Primeiros Passos**
1. Bem-vindo ao Painel — visão geral, saldo, troca de loja
2. Como completar o cadastro da Empresa
3. Verificação de WhatsApp obrigatória

**Operações**
4. Dashboard — métricas, gráfico de desempenho, integrações
5. Envios — criar envio manual, importar planilha, geração de DANFE, andamento automático
6. Live View — visitantes online em tempo real, globo, controles de Som e Pause
7. Postagens — templates de e-mail/SMS/WhatsApp, configs `[conf_tag:value]`, NFe somente por e-mail
8. Upsell — ofertas integradas aos e-mails de rastreio
9. Recuperação de Vendas — checkouts abandonados, canais (Vega, Zedy, Luna, Corvex, Adoorei, Shopify, Nuvorafy), cobrança por SMS/E-mail
10. Taxação — fluxo de cobrança extra, página pública customizável
11. Falha na Entrega — fluxo de 3 etapas e página pública
12. Confirmação de Pagamento — editor visual e envio automático

**Financeiro**
13. Moedas — recarga via PIX, como o saldo é debitado, cashback
14. Indicação — link de afiliado, comissão de 10%

**Negócio**
15. Empresa — dados fiscais, razão social, branding da loja
16. Integrações — conectar checkouts, webhooks, status no Dashboard
17. WhatsApp — instâncias UAZAPI, fila de envios, fallback

**Sistema**
18. Configurações — transportadora (JL/VETOR), preferências
19. Suporte — abrir chamado e códigos de verificação

Cada card terá:
- **Resumo** (1–2 linhas) visível no card.
- **Conteúdo detalhado** no modal com:
  - "Para que serve"
  - "Como usar (passo a passo numerado)"
  - "Dicas importantes"
  - "Atenção / Cuidados"
  - Link interno (`react-router`) "Abrir agora" para a página relacionada.

## Detalhes técnicos

**Arquivos novos:**
- `src/pages/Tutorial.tsx` — página com header, busca, filtro de categoria e grid.
- `src/components/tutorial/TutorialCard.tsx` — card individual com botão que abre o dialog.
- `src/components/tutorial/TutorialDialog.tsx` — modal renderizando o conteúdo detalhado.
- `src/data/tutorials.ts` — array tipado com todos os tutoriais (id, categoria, ícone, título, resumo, passos[], dicas[], avisos[], rota).

**Arquivos editados:**
- `src/App.tsx` — adicionar `<Route path="tutorial" element={<Tutorial />} />` dentro de `/loja/:lojaId`.
- `src/components/layout/AppSidebar.tsx` — adicionar item `Tutorial` (ícone `GraduationCap`) na seção **Sistema**, antes de "Suporte".

**Tecnologia:**
- Componentes shadcn já existentes: `Card`, `Dialog`, `Input` (busca), `Badge`, `Button`, `ScrollArea`.
- Estado local (useState) para termo de busca e categoria selecionada — sem backend, conteúdo 100% estático em `tutorials.ts`.
- Mantém o tema preto e dourado existente, glass/glow-border consistente com o resto do painel.

**Restrições:**
- Conteúdo apenas em português, linguagem simples, sem termos técnicos.
- Sem mencionar "Supabase" em nenhum texto (usar "backend" / "Lovable Cloud" se necessário).
- O card de "Recuperação" indica "disponível para contas autorizadas" (respeitando a restrição existente).

## Fora de escopo

- Sem persistência de "tutoriais lidos" no banco (pode ser adicionado depois se desejar).
- Sem vídeos — apenas texto + ícones.
- Não altera nenhuma funcionalidade existente.
