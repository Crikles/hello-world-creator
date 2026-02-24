

# Sistema Multi-Tenant: Contas de Usuario + Lojas

## Resumo

Transformar o sistema atual (single-tenant) em um sistema multi-usuario onde cada pessoa cria sua conta, pode ter ate 5 lojas, e cada loja tem seus proprios dados isolados (empresas, envios, pedidos, webhooks, integracoes).

---

## Estrutura do Banco de Dados

### Novas tabelas

**1. `profiles`** - Dados do usuario
- `id` (uuid, PK, referencia auth.users)
- `full_name` (text)
- `email` (text)
- `created_at` (timestamptz)
- Trigger automatico: cria profile quando usuario se cadastra

**2. `lojas`** - Lojas do usuario (max 5)
- `id` (uuid, PK)
- `user_id` (uuid, FK para auth.users)
- `nome` (text) - nome da loja
- `slug` (text, unique) - identificador unico para URLs de webhook
- `created_at` / `updated_at` (timestamptz)
- Trigger de validacao: impedir mais de 5 lojas por usuario

### Alteracoes nas tabelas existentes

**3. Adicionar `loja_id` nas tabelas:**
- `empresas` -> adicionar coluna `loja_id` (uuid, FK para lojas)
- `envios` -> adicionar coluna `loja_id` (uuid, FK para lojas)
- `pedidos` -> adicionar coluna `loja_id` (uuid, FK para lojas)
- `webhook_logs` -> adicionar coluna `loja_id` (uuid, FK para lojas)

### RLS Policies

Todas as tabelas terao policies que garantem que o usuario so acessa dados das suas proprias lojas:
- `profiles`: usuario le/edita apenas seu proprio perfil
- `lojas`: usuario CRUD apenas nas suas proprias lojas
- `empresas`, `envios`, `pedidos`, `webhook_logs`: acesso apenas para registros vinculados a lojas do usuario autenticado

---

## Paginas Novas

### 4. Pagina de Login (`/login`)
- Formulario com email e senha
- Link para criar conta
- Design no tema preto e dourado

### 5. Pagina de Cadastro (`/signup`)
- Formulario com nome, email e senha
- Confirmacao de email obrigatoria
- Apos confirmar email, redireciona para login

### 6. Pagina de Selecao de Loja (`/lojas`)
- Apos login, usuario ve suas lojas
- Botao para criar nova loja (ate 5)
- Clicar numa loja redireciona para o Dashboard daquela loja
- Cards com nome da loja e data de criacao

---

## Alteracoes na Navegacao

### 7. Rotas protegidas
- Todas as rotas do painel (Dashboard, Envios, etc.) exigem autenticacao
- Rotas incluem o ID da loja: `/loja/:lojaId/dashboard`, `/loja/:lojaId/envios`, etc.
- Componente `ProtectedRoute` que verifica se usuario esta logado
- Componente `LojaProvider` (context) que carrega a loja selecionada

### 8. Sidebar atualizado
- Mostrar nome da loja no header do sidebar
- Adicionar botao para trocar de loja (voltar para `/lojas`)
- Adicionar botao de logout

---

## Webhook Isolado por Loja

### 9. URL de webhook com identificador da loja
- Novo formato: `/functions/v1/webhook-vega?loja=SLUG_DA_LOJA`
- A edge function `webhook-vega` recebera o `slug` da loja via query param
- Busca o `loja_id` pelo slug e vincula o pedido/envio a loja correta
- Pagina de Integracoes mostra a URL com o slug da loja selecionada

---

## Contexto da Aplicacao

### 10. LojaContext
- Context React que armazena a loja ativa
- Todas as queries do Supabase filtram por `loja_id`
- Dashboard, Envios, Empresa, Integracoes, Configuracoes -- tudo filtrado pela loja ativa

---

## Fluxo do Usuario

```text
Cadastro (/signup)
    |
    v
Confirma email
    |
    v
Login (/login)
    |
    v
Selecao de Loja (/lojas)
    |-- Cria primeira loja
    |
    v
Dashboard da Loja (/loja/:id/)
    |-- Envios, Empresa, Integracoes, Config
    |-- Pode voltar para trocar de loja
```

---

## Sequencia de Implementacao

1. Migration: criar tabelas `profiles` e `lojas` + adicionar `loja_id` nas tabelas existentes + RLS policies + triggers
2. Paginas de Auth: Login e Signup com o tema preto e dourado
3. Pagina de selecao/criacao de lojas
4. LojaContext + ProtectedRoute
5. Atualizar todas as paginas para filtrar por `loja_id`
6. Atualizar Sidebar com nome da loja, troca de loja e logout
7. Atualizar webhook-vega para receber slug da loja
8. Atualizar pagina de Integracoes para mostrar URL com slug

