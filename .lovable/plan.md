## Objetivo

Transformar o projeto **Magnus Logistica** num site enxuto que mostra apenas a **tela de rastreio** (e o checkout PIX dela), puxando dados do **mesmo backend (Lovable Cloud) deste projeto Magnus**. Assim, quando um pedido entra no painel daqui, ele aparece em tempo real no site isolado — sem duplicar banco, sem sincronização.

## Arquitetura recomendada

```text
┌─────────────────────────┐         ┌──────────────────────────┐
│  Painel Magnus (este)   │────────▶│  Lovable Cloud (Supabase)│
│  - cadastra envios      │  write  │  - envios                │
│  - dispara emails/SMS   │         │  - postagem_eventos      │
└─────────────────────────┘         │  - pix_payments          │
                                    │  - lojas, postagem_config│
┌─────────────────────────┐  read   └──────────────────────────┘
│ Magnus Logistica (novo) │◀──────────────┘
│  - /rastreio/:codigo    │   + Realtime
│  - /pagamento/:id       │
└─────────────────────────┘
```

- **Um único banco** (o deste projeto). O site isolado só lê (e cria PIX quando o cliente paga).
- **Tempo real**: a tela de rastreio assina `postgres_changes` em `envios` e `postagem_eventos` via Realtime, então qualquer atualização feita aqui aparece instantaneamente lá.
- **Sem migração de dados** — o site novo aponta para o backend atual.

## Passos no projeto "Magnus Logistica"

1. **Desconectar o Lovable Cloud próprio** dele (o banco dele fica órfão; tudo bem, não usaremos).
2. **Substituir `src/integrations/supabase/client.ts`** para apontar para a URL + anon key deste projeto Magnus.
3. **Limpar páginas, rotas e componentes não usados**, mantendo apenas:
   - `pages/Rastreio.tsx`
   - `pages/Pagamento.tsx` (PIX da taxa de reenvio/importação, se quiser manter)
   - `pages/NotFound.tsx`, `pages/TermosPrivacidade.tsx`
   - Componentes em `components/rastreio/*` e o que `Rastreio.tsx`/`Pagamento.tsx` importam
   - `App.tsx` reduzido só às rotas públicas
4. **Remover do sidebar e do projeto**: Dashboard, Envios, Postagens, Lojas, Configurações, Admin, LiveView, WhatsApp, Upsell, Recuperação, Indicação, Empresa, Login/Signup, ApiDocs, Tutorial, Suporte, Integrações, Moedas, ConfirmacaoPagamento — não fazem sentido no site público.
5. **Remover edge functions** que não atendem o rastreio público; manter (chamando o backend deste projeto via fetch direto) apenas as necessárias:
   - `rastreio-info` (lê envio + eventos)
   - `pagamento-info` + `create-pix-payment` + webhook (se mantiver o pagamento PIX no site isolado)
6. **Adicionar Realtime** na tela de rastreio: `supabase.channel(...).on('postgres_changes', { table: 'envios', filter: 'codigo=eq.<X>' })` e idem para `postagem_eventos`.
7. **Apontar o domínio** do site isolado (ex.: `rastreio.magnus...`) para o projeto Magnus Logistica publicado.

## Passos neste projeto Magnus (backend)

1. **Habilitar Realtime** nas tabelas que o site público vai ouvir:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.envios;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.postagem_eventos;
   ```
2. **Conferir RLS** de leitura pública por código de rastreio (já existe hoje, pois o site atual já lê) — garantir que `anon` consegue dar `SELECT` em `envios`/`postagem_eventos` filtrando pelo `codigo`. Se não permitir hoje, ajustar política para `USING (true)` apenas nas colunas necessárias, ou expor via edge function `rastreio-info` (que é a abordagem já em uso e é a recomendada — mantém anon sem acesso direto).
3. **CORS nas edge functions** (`rastreio-info`, `pagamento-info`, etc.): liberar o domínio do site isolado.
4. Nenhuma mudança de dados — pedidos continuam entrando normalmente.

## Decisões para você confirmar

- **Pagamentos PIX**: manter no site isolado (cliente paga lá mesmo, usando as functions deste projeto) ou tirar e deixar só a tela de rastreio?
- **Login admin no site isolado**: confirmo que **não** terá login — é só uma página pública de rastreio.
- **Domínio**: vai apontar `rastreio.seudominio` para o projeto Magnus Logistica? (você cuida do DNS depois.)

## Resultado

- Quando um envio é criado/atualizado no painel Magnus → aparece em tempo real no site Magnus Logistica.
- Banco único, sem sincronização, sem risco de divergência.
- Site isolado fica leve (só rastreio), independente para deploy/domínio próprio.
