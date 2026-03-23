

## Plano: Sandbox de Teste na Documentação Pública

### O que será feito

Adicionar uma seção **"Testar API"** na página `/documentacao` onde o usuário cola seu token, vê um payload de exemplo editável, clica em "Enviar Teste" e vê a resposta da API em tempo real — confirmando se o pedido entrou no painel.

### Implementação

**Arquivo: `src/pages/DocumentacaoPublica.tsx`**

- Nova seção entre "Exemplos de Integração" e "Resposta de Sucesso"
- Componentes:
  - Textarea com payload JSON pré-preenchido (editável pelo dev)
  - Botão "Enviar Requisição de Teste"
  - Área de resultado mostrando: status HTTP, resposta JSON formatada, e badge verde/vermelho de sucesso/erro
  - Se o token estiver vazio, botão fica desabilitado com tooltip "Insira seu token acima"
- Ao clicar, faz `fetch(ENDPOINT_BASE?token=..., { method: "POST", body: payload })` diretamente do browser
- Mostra loading spinner durante a requisição
- Exibe a resposta completa com destaque no `codigo_rastreio` se sucesso
- Aviso: "Este teste cria um pedido real na sua conta"

### Detalhes técnicos
- Usa `fetch` direto (a API já tem CORS habilitado com `Access-Control-Allow-Origin: *`)
- Estado: `testPayload` (string JSON editável), `testResult` (objeto resposta), `testLoading`, `testStatus` (número HTTP)
- Validação local de JSON antes de enviar (try/catch no `JSON.parse`)
- Nenhum arquivo backend alterado — a API já suporta tudo necessário

