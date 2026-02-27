

# Admin Leads - Base de Clientes Global

## Objetivo
Criar uma secao "Leads" no painel admin que armazena permanentemente todos os clientes que passaram pelo sistema, independentemente de exclusoes feitas pelos usuarios em suas lojas.

## Solucao

### 1. Nova tabela `leads` (migracao SQL)

Tabela para armazenar dados de clientes extraidos dos envios:

```text
leads
- id (uuid, PK)
- nome (text)
- cpf (text, nullable)
- telefone (text, nullable)
- email (text)
- produto (text, nullable)
- valor (numeric, default 0)
- endereco (text, nullable)
- numero (text, nullable)
- bairro (text, nullable)
- complemento (text, nullable)
- cidade (text, nullable)
- estado (text, nullable)
- cep (text, nullable)
- loja_id (uuid, nullable)
- envio_id (uuid, nullable)
- created_at (timestamptz)
```

RLS: apenas admins podem ler/gerenciar. Usuarios comuns nao tem acesso.

### 2. Trigger automatico na tabela `envios`

Criar uma funcao + trigger que, a cada INSERT ou UPDATE na tabela `envios`, faz upsert na tabela `leads` usando `envio_id` como chave. Isso garante que:
- Dados sao salvos automaticamente sem alterar codigo existente
- Mesmo que o envio seja excluido (soft delete via `deleted_at`), o lead permanece
- Atualizacoes no envio atualizam o lead correspondente

### 3. Nova pagina `AdminLeads` (`src/pages/admin/AdminLeads.tsx`)

- Tabela com todas as colunas: Nome, CPF, Telefone, Email, Produto, Valor, Cidade/UF
- Campo de busca por nome, email ou CPF
- Paginacao para lidar com grandes volumes
- Contador total de leads
- Botao para exportar (futuro)

### 4. Registrar rota e menu

- Rota `/admin/leads` no `App.tsx`
- Item "Leads" no `AdminSidebar.tsx` com icone `Contact`

---

## Detalhes Tecnicos

### Migracao SQL

```text
-- Tabela leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  telefone text,
  email text NOT NULL,
  produto text,
  valor numeric DEFAULT 0,
  endereco text,
  numero text,
  bairro text,
  complemento text,
  cidade text,
  estado text,
  cep text,
  loja_id uuid,
  envio_id uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS: somente admins
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Funcao trigger para capturar leads dos envios
CREATE OR REPLACE FUNCTION public.capture_lead_from_envio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.leads (nome, cpf, telefone, email, produto, valor, endereco, numero, bairro, complemento, cidade, estado, cep, loja_id, envio_id)
  VALUES (
    NEW.cliente_nome,
    NEW.cliente_cpf,
    NEW.cliente_telefone,
    NEW.cliente_email,
    NEW.produto,
    NEW.valor,
    NEW.cliente_endereco,
    NEW.cliente_numero,
    NEW.cliente_bairro,
    NEW.cliente_complemento,
    NEW.cliente_cidade,
    NEW.cliente_estado,
    NEW.cliente_cep,
    NEW.loja_id,
    NEW.id
  )
  ON CONFLICT (envio_id) WHERE envio_id IS NOT NULL
  DO UPDATE SET
    nome = EXCLUDED.nome,
    cpf = EXCLUDED.cpf,
    telefone = EXCLUDED.telefone,
    email = EXCLUDED.email,
    produto = EXCLUDED.produto,
    valor = EXCLUDED.valor,
    endereco = EXCLUDED.endereco,
    numero = EXCLUDED.numero,
    bairro = EXCLUDED.bairro,
    complemento = EXCLUDED.complemento,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    cep = EXCLUDED.cep;
  RETURN NEW;
END;
$$;

-- Indice unico parcial para upsert
CREATE UNIQUE INDEX leads_envio_id_unique ON public.leads (envio_id) WHERE envio_id IS NOT NULL;

-- Trigger
CREATE TRIGGER on_envio_capture_lead
  AFTER INSERT OR UPDATE ON public.envios
  FOR EACH ROW EXECUTE FUNCTION capture_lead_from_envio();
```

### Arquivos criados
1. `src/pages/admin/AdminLeads.tsx` -- pagina de visualizacao de leads

### Arquivos modificados
1. `src/App.tsx` -- nova rota /admin/leads
2. `src/components/admin/AdminSidebar.tsx` -- item de menu Leads

### Pagina AdminLeads

- Query com `supabase.from("leads").select("*").order("created_at", { ascending: false })`
- Busca client-side por nome/email/cpf
- Exibe valor formatado em R$
- Endereco concatenado: "Rua, Numero - Bairro, Cidade/UF - CEP"
- Badge com nome da loja (join com tabela lojas se necessario)

### Contagem no Dashboard Admin

Adicionar card "Leads" no `AdminDashboard.tsx` com contagem total.
