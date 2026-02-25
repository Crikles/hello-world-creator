

# Ajuste na Configuracao de Taxacao: Separar Email e Site

## Problema Atual

O campo "Mensagem da Taxa" no painel de configuracao afeta tanto o preview do Email quanto o preview do Site Rastreio. No entanto, no site real (`/p/:envioId`), essa mensagem nao aparece -- la existe uma mensagem fixa padrao. Alem disso, o preview do Site Rastreio nao corresponde a pagina real de pagamento.

## Mudancas Planejadas

### 1. Separar "Mensagem da Taxa" -- apenas para Email

No formulario de configuracao (`TaxacaoConfig.tsx`), o campo "Mensagem da Taxa" sera movido para uma secao claramente identificada como "Configuracoes do Email". Um label ou subtitulo indicara que essa mensagem aparece apenas no email enviado ao cliente.

Os campos que afetam o site de pagamento ficam em secao separada:
- Mensagem do Botao
- Valor
- Prazo
- Link de Checkout
- Cores
- Toggles (mostrar valor, mostrar prazo)

### 2. Preview do Site Rastreio espelhando a pagina `/p` real

O componente `TaxacaoTrackingPreview` sera reescrito para espelhar o layout real da pagina `Pagamento.tsx` em vez do mockup atual de timeline. O novo preview mostrara:

- Header com logo redonda + nome da empresa + "PAGAMENTO SEGURO"
- Indicador de etapas (Pedido > Taxacao > Liberacao > Entrega)
- Card "Resumo da Cobranca" com dados exemplo (nome, CPF, endereco, produto, transportadora, rastreio)
- Total a pagar com o valor configurado
- Mensagem fixa padrao (a mesma que aparece na pagina real)
- Card "Efetuar Pagamento" com metodo PIX e botao com texto/cor personalizavel
- Prazo de pagamento
- Selos de seguranca

O preview NAO usara a "Mensagem da Taxa" (que e exclusiva do email).

### 3. Remover "Mensagem da Taxa" do preview do Site

No preview do site, a mensagem exibida sera sempre a mensagem fixa padrao que ja existe na pagina `/p` real: "Sua encomenda foi retida pela fiscalizacao aduaneira e aguarda a quitacao da taxa de liberacao..."

## Detalhes Tecnicos

### Arquivo: `src/components/postagens/TaxacaoConfig.tsx`

**Formulario (secao esquerda):**
- Reorganizar campos em duas subsecoes visuais:
  1. "Configuracoes do Site de Pagamento": Mensagem do Botao, Valor, Prazo, Link de Checkout, Mostrar valor, Mostrar prazo, Cor do Header, Cor do Botao
  2. "Mensagem do Email": Campo "Mensagem da Taxa" com nota explicativa de que so aparece no email

**Preview do Site (componente `TaxacaoTrackingPreview`):**
- Reescrever para mostrar um mini-espelho da pagina `/p` real em formato mobile
- Incluir: header com logo redonda, steps, resumo com dados exemplo, valor, mensagem fixa, botao PIX com texto e cor personalizaveis, prazo, selos de seguranca
- Nao usar `settings.mensagem_taxa` -- usar a mensagem fixa padrao

**Preview do Email:**
- Continua usando `settings.mensagem_taxa` normalmente (sem mudancas)

### Arquivo: `src/pages/Pagamento.tsx`
- Sem alteracoes necessarias (ja usa mensagem fixa)

