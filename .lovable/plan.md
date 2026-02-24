

# Postagens - Reestruturar Interface com NF Gratuita e Configuracao de Dias

## Resumo

Reorganizar a pagina de Postagens para refletir as regras de negocio corretas:
- O primeiro email (Nota Fiscal) e sempre gratuito e enviado automaticamente
- Os demais emails de rastreamento sao opcionais e cobrados R$ 0,15 cada
- A configuracao de delay deve usar "dias" em vez de "horas" e ficar visivel diretamente na lista de eventos (sem precisar abrir o dialog)

---

## Mudancas na Interface

### 1. Secao "Configuracoes Gerais" - Reestruturar toggles

Substituir os dois toggles atuais por:

- **Enviar NF (primeiro email padrao)** - Toggle para enviar o email da Nota Fiscal (gratuito, sempre o primeiro evento do fluxo). Descricao: "Envia automaticamente a Nota Fiscal por email ao cliente. Este email e gratuito."
- **Ativar emails de rastreamento** - Toggle para ativar/desativar os demais emails do fluxo (cobrados R$ 0,15 cada). Descricao: "Envia emails automaticos de atualizacao de status. Cada email custa R$ 0,15."

Isso substituira os campos `enviar_nfe_email` e `enviar_emails` respectivamente.

### 2. Eventos do Fluxo - Configuracao de dias inline

Na lista de eventos ativos, para cada evento (exceto o primeiro - NF), mostrar um campo de input numerico inline para configurar o delay em **dias** (nao horas) apos o evento anterior. Isso permite que o usuario configure os tempos diretamente na lista sem abrir o dialog de edicao.

- O primeiro evento (Nota Fiscal Emitida) nao tera campo de delay (e instantaneo)
- Os demais eventos mostrarao: `[input numerico] dias apos anterior`
- O campo `delay_horas` no banco continuara sendo usado, mas sera tratado como dias no frontend (multiplicando por 24 ao salvar e dividindo por 24 ao exibir)

### 3. Custo estimado - Excluir NF da contagem

O calculo de custo estimado deve excluir o primeiro evento (NF), que e gratuito:
- Contar apenas eventos com `enviar_email = true` e `ordem > 1` (ou que nao sejam o primeiro)
- Mostrar: "R$ 0,15 x {N} emails de rastreamento = R$ {total}"
- Mencionar que o email de NF e gratuito

### 4. Evento de NF - Visual diferenciado

O primeiro evento (Nota Fiscal Emitida) tera um visual diferente:
- Badge "Gratuito" em verde
- Nao mostrara botao de remover (e obrigatorio)
- Nao mostrara campo de delay

---

## Detalhes Tecnicos

### Arquivos a modificar

**`src/pages/Postagens.tsx`**:
- Reestruturar a secao de "Configuracoes Gerais" com os dois novos toggles
- Adicionar input de dias inline para cada evento na lista (exceto o primeiro)
- Atualizar calculo de custo para excluir o primeiro evento (NF gratuita)
- Diferenciar visualmente o primeiro evento (NF) com badge "Gratuito" e sem botao de remover
- Converter delay_horas para dias no display (dividir por 24) e ao salvar (multiplicar por 24)

### Banco de dados

Nenhuma alteracao necessaria. Os campos existentes (`enviar_nfe_email`, `enviar_emails`, `delay_horas`) sao suficientes para suportar as mudancas. O `delay_horas` sera reinterpretado como dias no frontend.

