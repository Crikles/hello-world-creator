

# Melhorias na Pagina de Pagamento (Taxacao)

## Mudancas Planejadas

### 1. Logo sempre redonda (estilo avatar)
A logo da empresa no header sera exibida com `border-radius: 50%` e dimensoes fixas (ex: 48x48), garantindo formato circular igual aos emails.

### 2. Resumo da Cobranca com todos os dados do cliente
A edge function `pagamento-info` atualmente retorna apenas `cliente_nome`. Sera atualizada para retornar tambem: `cliente_cpf`, `cliente_endereco`, `cliente_numero`, `cliente_bairro`, `cliente_cidade`, `cliente_estado`, `cliente_cep`.

No frontend, o card "Resumo da Cobranca" exibira:
- Nome do cliente
- CPF (com mascara XXX.XXX.XXX-XX)
- Endereco completo (rua, numero, bairro, cidade/UF, CEP)
- Produto
- Referencia (codigo de rastreio)
- Transportadora

### 3. Pagamento somente via PIX
O tile de metodo de pagamento mudara de "PIX ou Cartao" para apenas "PIX". O icone `CreditCard` sera removido da area de metodos.

### 4. Mensagem fixa padrao profissional
A mensagem abaixo do "Total a Pagar" sera fixa (ignorando a do email) com texto profissional:

> "Sua encomenda foi retida pela fiscalizacao aduaneira e aguarda a quitacao da taxa de liberacao. O pagamento e indispensavel para que o processo de entrega seja retomado. Efetue o pagamento dentro do prazo para evitar o retorno da mercadoria ao remetente."

### 5. Responsividade mobile completa
Ajustes CSS para telas pequenas:
- Header empilha logo + "voltar" verticalmente
- Grid de 2 colunas vira coluna unica (ja existe para < 900px)
- Padding reduzido no card de pagamento
- Fonte do valor total ajustada
- Botao de pagamento com altura adaptada

## Arquivos Alterados

### `supabase/functions/pagamento-info/index.ts`
- Linha 44: Adicionar campos do cliente no select: `cliente_cpf, cliente_endereco, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado, cliente_cep`
- Linhas 91-98: Incluir esses campos no objeto de resposta

### `src/pages/Pagamento.tsx`
- **Interface `EnvioData`**: Adicionar campos `cliente_cpf`, `cliente_endereco`, `cliente_numero`, `cliente_bairro`, `cliente_cidade`, `cliente_estado`, `cliente_cep`
- **Header (linha 147)**: Aplicar estilo circular na logo (`border-radius: 50%; width: 48px; height: 48px; object-fit: cover`)
- **Resumo da Cobranca (linhas 180-192)**: Adicionar linhas para Nome, CPF, Endereco
- **Mensagem fixa (linha 204)**: Substituir `{tax.mensagem_taxa}` por texto fixo padrao
- **Metodo pagamento (linha 227)**: Trocar "PIX ou Cartao" por "PIX"
- **CSS responsivo**: Adicionar media queries para mobile (padding, font-size, layout do header)
