

## Plano: Adicionar seção "Prompt para IA" na documentação

### O que será feito
Adicionar uma nova seção na página de documentação com um **prompt completo e pronto para copiar**, que o usuário pode colar diretamente em qualquer IA (Lovable, Antigravity, ChatGPT, etc.) para implementar a integração com a API do Magnus Frete na loja dele.

O prompt incluirá tudo que a IA precisa: endpoint, autenticação, payload completo, exemplos de cURL/JS/Python/PHP, tratamento de erros e resposta esperada — **tudo em um único bloco copiável**.

### Alteração

**`src/pages/DocumentacaoPublica.tsx`**

1. Criar uma constante `aiPrompt` com o texto completo do prompt, incluindo:
   - Contexto: "Integre minha loja com a API do Magnus Frete"
   - Endpoint e método de autenticação (token via query param)
   - Payload completo com todos os campos e quais são obrigatórios
   - Exemplo de cURL funcional
   - Exemplo de código JS (fetch)
   - Resposta esperada (201 + JSON com codigo_rastreio)
   - Tratamento de erros (400, 401, 422, 500)
   - Instruções claras: "Substitua SEU_TOKEN pelo token real da loja"

2. Adicionar uma nova seção visualmente destacada (com borda primária, ícone de IA/Zap) logo após o "Quick Start", com:
   - Título: "Prompt para IA" + badge "Copiar e Colar"
   - Descrição curta explicando que basta copiar e jogar na IA
   - O prompt completo dentro de um `<pre>` com scroll
   - Botão de copiar grande e proeminente (usa o `CopyBtn` existente ou um botão dedicado)

### Conteúdo do prompt (resumo)
O prompt será em português, autocontido, e incluirá:
- Endpoint exato com placeholder `SEU_TOKEN`
- Header obrigatório `Content-Type: application/json`
- Payload JSON completo de exemplo
- cURL pronto
- Código JavaScript (fetch) pronto
- Resposta de sucesso esperada
- Lista de erros possíveis
- Instrução para substituir o token

### Posição na página
Entre a seção "Quick Start" e "Autenticação & CORS" — é a primeira coisa útil após o usuário entender os 4 passos.

