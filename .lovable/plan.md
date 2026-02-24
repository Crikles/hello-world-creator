
# Painel Admin + Sistema de Creditos

## Resumo

Criar um painel administrativo exclusivo para usuarios com role `admin`, com visao completa de todos os usuarios, lojas e envios do sistema. Incluir um sistema de creditos (moedas) onde o admin pode adicionar creditos a contas de usuarios.

---

## 1. Banco de Dados - Novas Tabelas

### Tabela `creditos`
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users) -- dono do saldo
- `saldo` (integer, default 0) -- saldo atual de moedas
- `updated_at` (timestamptz)
- Trigger: criar registro automaticamente quando usuario se cadastra (saldo = 0)
- RLS: usuario le seu proprio saldo; admin le/edita todos

### Tabela `creditos_transacoes`
- `id` (uuid, PK)
- `user_id` (uuid) -- usuario que recebeu/gastou
- `tipo` (text) -- 'adicao' | 'consumo'
- `quantidade` (integer) -- moedas adicionadas ou consumidas
- `descricao` (text) -- motivo (ex: "Adicionado pelo admin", "Envio de NF-e #123")
- `admin_id` (uuid, nullable) -- quem adicionou (se foi o admin)
- `created_at` (timestamptz)
- RLS: usuario ve suas proprias transacoes; admin ve todas

---

## 2. Paginas do Painel Admin

Todas as rotas admin ficam em `/admin/*` e sao protegidas verificando `has_role(uid, 'admin')`.

### 2a. `/admin` - Dashboard Admin
- Total de usuarios cadastrados
- Total de lojas no sistema
- Total de envios processados
- Total de creditos em circulacao
- Cards com metricas gerais

### 2b. `/admin/usuarios` - Gestao de Usuarios
- Tabela listando todos os usuarios (profiles + user_roles)
- Colunas: Nome, Email, Role, Data de cadastro, Saldo de creditos, Qtd de lojas
- Botao para adicionar creditos a um usuario (dialog com campo de quantidade e descricao)
- Botao para ver detalhes do usuario (lojas, envios, transacoes)

### 2c. `/admin/creditos` - Historico de Transacoes
- Tabela com todas as transacoes de creditos do sistema
- Filtros por usuario, tipo (adicao/consumo), data

---

## 3. Layout Admin

### Sidebar Admin separado
- Menu proprio com itens: Dashboard, Usuarios, Creditos
- Botao "Voltar ao Painel" para retornar ao `/lojas`
- Botao de logout
- Design consistente com o tema preto e dourado

### Acesso ao Admin
- Na pagina `/lojas`, se o usuario for admin, mostrar um botao/link "Painel Admin" no header
- Componente `AdminRoute` que verifica a role antes de renderizar

---

## 4. Funcionalidade de Adicionar Creditos

- No painel `/admin/usuarios`, o admin clica em "Adicionar Creditos" em qualquer usuario
- Dialog abre com: campo quantidade, campo descricao
- Ao confirmar:
  1. Atualiza `creditos.saldo` do usuario (incrementa)
  2. Insere registro em `creditos_transacoes` com tipo='adicao' e admin_id
- Toast de confirmacao

---

## 5. Visao do Saldo pelo Usuario

- No header da pagina `/lojas` ou no sidebar, mostrar o saldo de moedas do usuario logado
- Formato: icone de moeda + numero (ex: "150 moedas")

---

## Detalhes Tecnicos

### Migrations SQL

```text
-- Tabela creditos (saldo por usuario)
CREATE TABLE public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  saldo INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

-- Tabela creditos_transacoes (historico)
CREATE TABLE public.creditos_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('adicao', 'consumo')),
  quantidade INTEGER NOT NULL,
  descricao TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos_transacoes ENABLE ROW LEVEL SECURITY;

-- RLS creditos
CREATE POLICY "Users view own credits" ON public.creditos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins full access credits" ON public.creditos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS creditos_transacoes
CREATE POLICY "Users view own transactions" ON public.creditos_transacoes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins full access transactions" ON public.creditos_transacoes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: criar saldo ao cadastrar usuario
CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.creditos (user_id, saldo) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_credits();

-- Admin precisa ler todos os profiles e lojas
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all lojas" ON public.lojas
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all envios" ON public.envios
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
```

### Novas rotas no App.tsx

```text
/admin          -> AdminDashboard
/admin/usuarios -> AdminUsuarios
/admin/creditos -> AdminCreditos
```

### Novos arquivos

```text
src/pages/admin/AdminDashboard.tsx
src/pages/admin/AdminUsuarios.tsx
src/pages/admin/AdminCreditos.tsx
src/components/admin/AdminLayout.tsx
src/components/admin/AdminSidebar.tsx
src/components/AdminRoute.tsx
src/hooks/useIsAdmin.ts
```

### Hook useIsAdmin

- Consulta `user_roles` para verificar se o usuario logado tem role `admin`
- Retorna `{ isAdmin, loading }`
- Usado no `AdminRoute` e para mostrar/esconder o botao "Painel Admin"

---

## Sequencia de Implementacao

1. Migration: criar tabelas `creditos` e `creditos_transacoes` + RLS + triggers + policies de admin nas tabelas existentes
2. Hook `useIsAdmin` para verificar role do usuario
3. Componente `AdminRoute` para proteger rotas admin
4. Layout admin (AdminLayout + AdminSidebar)
5. Pagina AdminDashboard com metricas gerais
6. Pagina AdminUsuarios com tabela de usuarios e funcao de adicionar creditos
7. Pagina AdminCreditos com historico de transacoes
8. Atualizar App.tsx com rotas admin
9. Adicionar botao "Painel Admin" na pagina de Lojas e exibir saldo de moedas do usuario
