

# Correção do Rastreio: Rota, URL nos E-mails e Exibição em Tempo Real

## Problema Principal

O link no e-mail direciona para `logisticajltransportes.com/r/BRADDD365C04`, mas:

1. O DNS do domínio customizado ainda não está configurado, então o site não carrega
2. Mesmo acessando pelo domínio do Lovable (`magnusfrete.lovable.app`), a rota `/r/:codigo` só existe no modo "logística" (LogisticsRoutes), e o domínio principal usa PanelRoutes -- que não tem essa rota, resultando em "Not Found"
3. A página de rastreio precisa exibir dados do cliente e etapas em tempo real

## Solução

### 1. Adicionar rota `/r/:codigoParam` também no PanelRoutes (App.tsx)

Atualmente, a rota de rastreio só existe dentro de `LogisticsRoutes`. Precisamos adicioná-la também em `PanelRoutes` para que funcione independente do domínio:

```typescript
// Em PanelRoutes, adicionar antes do catch-all:
<Route path="/r" element={<Rastreio />} />
<Route path="/r/:codigoParam" element={<Rastreio />} />
<Route path="/p/:envioId" element={<Pagamento />} />
```

### 2. Atualizar URL no e-mail (send-email edge function)

Trocar o domínio fixo pela URL do projeto Lovable (que funciona agora), usando uma variável de ambiente ou o domínio publicado:

```typescript
// De:
let urlBotaoCta = `https://logisticajltransportes.com/r/${codigoRastreio}`;
// Para:
let urlBotaoCta = `https://magnusfrete.lovable.app/r/${codigoRastreio}`;
```

Quando o DNS do domínio customizado estiver configurado, basta trocar de volta.

### 3. Atualizar templates de e-mail (emailTemplates.ts)

Todas as `url_botao_cta` nos templates padrão também apontam para o domínio customizado. Atualizar para usar o domínio funcional.

### 4. Exibir dados do cliente na página de rastreio

A página de Rastreio já exibe `cliente_nome` e detalhes do envio. A edge function `rastreio-info` já retorna esses dados. Nenhuma mudança necessária aqui, pois já funciona -- o problema era apenas a rota inacessível.

### 5. Formatação do produto na página de rastreio

Aplicar a mesma função `formatProduto` (que parseia o JSON de produtos) na página de rastreio, para exibir nomes legíveis em vez de JSON bruto.

---

## Resumo dos Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Adicionar rotas `/r` e `/r/:codigoParam` no PanelRoutes |
| `supabase/functions/send-email/index.ts` | Trocar domínio da URL do botão CTA |
| `src/components/postagens/emailTemplates.ts` | Atualizar URLs dos templates |
| `src/pages/Rastreio.tsx` | Adicionar formatação de produto (JSON para texto legível) |

