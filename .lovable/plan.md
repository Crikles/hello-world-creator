

## Plano: Página Pública de Documentação da API

### Situação atual
- A API Externa (`api-external/index.ts`) está implementada e funcional — aceita POST com token, valida campos, cria pedido + envio.
- A documentação atual (`ApiDocs.tsx`) está **dentro da área logada**, acessível apenas em `/loja/:lojaId/api-docs`. Usa `useLoja()` para pegar o token automaticamente.
- Precisa de uma versão **pública** acessível sem login.

### O que será feito

**1. Nova página pública: `src/pages/DocumentacaoPublica.tsx`**
- Acessível em `/documentacao` (sem autenticação)
- Conteúdo completo e profissional: endpoint, campos, exemplos (cURL, JavaScript, Python, PHP), respostas de sucesso e erro
- Campo de input onde o dev cola seu token — os exemplos de código atualizam automaticamente com o token informado
- Visual limpo e moderno, sem dependência de LojaContext
- Seções: Introdução, Autenticação, Endpoint, Campos do Payload, Exemplos de Código, Respostas, Erros, FAQ

**2. Rota pública no `App.tsx`**
- Adicionar `/documentacao` como rota pública dentro de `PanelRoutes`, fora do `ProtectedRoute`
- Funciona em `magnusfrete.lovable.app/documentacao` e em qualquer domínio custom configurado

**3. Verificar API Externa**
- Revisar os logs da edge function para confirmar que está operacional
- A function já está deployada e os logs mostram que está respondendo

### Arquivos alterados
- `src/pages/DocumentacaoPublica.tsx` — nova página pública
- `src/App.tsx` — adicionar rota `/documentacao`

