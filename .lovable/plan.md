

# Corrigir Toggle e Simplificar Integração Shopify

## Problemas identificados
1. O botão "Ativar integração" do Shopify está desabilitado (`disabled`) -- não permite desativar
2. O botão "Conectar OAuth" redireciona para o Shopify pedindo autorização, mas se o App não estiver configurado corretamente no Shopify Partner Dashboard, dá erro
3. A linguagem "OAuth" é técnica e confusa

## Solução

### 1. Adicionar coluna `ativo` na tabela `shopify_integrations`
- Nova coluna `ativo` (boolean, default true)
- Permite ativar/desativar sem apagar as credenciais salvas

### 2. Tornar o Switch funcional
- Quando ativado: marca `ativo = true` no banco
- Quando desativado: marca `ativo = false`
- O badge muda entre "Conectada" e "Inativa" conforme o valor

### 3. Simplificar a linguagem
- Trocar "Conectar OAuth" por "Autorizar Shopify"
- Adicionar explicação simples: "Clique para autorizar o acesso à sua loja Shopify. Você será redirecionado para o Shopify para confirmar."
- Remover menções técnicas a "OAuth" da interface

### 4. Atualizar Dashboard
- Usar o campo `ativo` para determinar se a integração está ativa no dashboard

## Detalhes tecnicos

### Migracao SQL
```sql
ALTER TABLE shopify_integrations ADD COLUMN ativo boolean DEFAULT true;
```

### Arquivos alterados
- `src/pages/Integracoes.tsx` -- Switch funcional com mutation de toggle, linguagem simplificada
- `src/pages/Dashboard.tsx` -- checar campo `ativo` na query

