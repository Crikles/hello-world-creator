

# Adicionar Origem de Envio + Localizacao no Rastreio + Corrigir Build Errors

## 1. Corrigir erros de build nas Edge Functions

Existem erros de tipagem TypeScript no Deno onde `Uint8Array` nao e aceito como `BufferSource`. Vou corrigir usando `.buffer` para resolver a incompatibilidade de tipos.

**Arquivos afetados:**
- `supabase/functions/send-push-notification/index.ts` - Adicionar cast `.buffer` em todas as chamadas `importKey`, `sign` e `encrypt`
- `supabase/functions/save-push-subscription/index.ts` - Tipar `err` como `unknown` e usar check `instanceof Error`

## 2. Adicionar campo "Origem de Envio" na tabela `postagem_config`

**Migracao SQL:**
- Adicionar colunas `origem_cidade` (text, nullable) e `origem_estado` (text, nullable) na tabela `postagem_config`

## 3. Adicionar campo de selecao na pagina de Postagens

**Arquivo: `src/pages/Postagens.tsx`**

Na aba "Configuracao", adicionar um card com dois campos:
- Select para o **Estado** (lista dos 27 estados brasileiros)
- Input para a **Cidade** (preenchido pelo usuario)

O valor sera salvo junto com as demais configuracoes na mutation `saveAll`.

## 4. Atualizar o endpoint `rastreio-info` para retornar a origem

**Arquivo: `supabase/functions/rastreio-info/index.ts`**

- Buscar `origem_cidade` e `origem_estado` da tabela `postagem_config`
- Retornar esses dados no response junto com os dados do lead (cidade/estado do destinatario do envio)
- Tambem retornar `cliente_cidade`, `cliente_estado` do envio

## 5. Atualizar a pagina de Rastreio para exibir localizacoes

**Arquivo: `src/pages/Rastreio.tsx`**

No timeline de eventos, adicionar informacoes de localizacao baseadas no status:
- **Postado**: "CIDADE_ORIGEM - ESTADO_ORIGEM" (origem configurada)
- **Coletado**: "de Unidade de Tratamento, CIDADE_ORIGEM"
- **Em Transito**: "de Unidade de Tratamento, CIDADE_ORIGEM para Unidade de Distribuicao, CIDADE_DESTINO"
- **Centro Local**: "Unidade de Distribuicao, CIDADE_DESTINO - ESTADO_DESTINO"
- **Saiu para Entrega**: "Unidade de Distribuicao, CIDADE_DESTINO"
- **Entregue**: "Pela Unidade de Distribuicao, CIDADE_DESTINO"

Isso replica o visual dos Correios mostrado no print, com as informacoes de localizacao abaixo do titulo de cada evento.

## Sequencia de implementacao

1. Corrigir build errors nas edge functions (tipagem)
2. Criar migracao para adicionar colunas de origem
3. Adicionar UI de selecao de origem em Postagens
4. Atualizar `rastreio-info` para retornar dados de localizacao
5. Atualizar timeline do Rastreio para exibir locais

