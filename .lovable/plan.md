

# Busca Automatica por CEP + Importacao de Leads via Planilha

## Resumo

Duas funcionalidades novas:

1. **Auto-preenchimento por CEP** - Ao digitar o CEP na pagina de Empresa e no Wizard de Novo Envio, o sistema consulta a API gratuita ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) e preenche automaticamente rua, bairro, cidade e estado.

2. **Upload de leads via planilha Excel** - Na pagina de Envios, um botao para importar envios em massa a partir de um arquivo CSV. Inclui tambem um botao para baixar uma planilha modelo com todas as colunas necessarias.

---

## Detalhes Tecnicos

### 1. Helper de busca de CEP

Criar `src/lib/cep-utils.ts` com uma funcao `fetchCep(cep: string)` que:
- Remove caracteres nao-numericos do CEP
- Valida se tem 8 digitos
- Faz fetch em `https://viacep.com.br/ws/{cep}/json/`
- Retorna `{ logradouro, bairro, localidade, uf }` ou `null` se invalido/erro

### 2. Pagina Empresa (`src/pages/Empresa.tsx`)

- No campo CEP (linha 379), adicionar um `onBlur` que chama `fetchCep`
- Ao retornar dados, preenche automaticamente: `endereco` (logradouro), `bairro`, `cidade` (localidade), `estado` (uf)
- Mostrar um indicador de carregamento sutil (spinner ou texto "Buscando...") ao lado do campo CEP enquanto consulta

### 3. Wizard Novo Envio (`src/components/envios/NovoEnvioWizard.tsx`)

- No campo CEP do Step 2 (linha 181), adicionar `onBlur` com a mesma logica
- Preenche: `cliente_endereco`, `cliente_bairro`, `cliente_cidade`, `cliente_estado`
- Mesmo indicador de carregamento

### 4. Importacao de planilha (`src/pages/Envios.tsx`)

Adicionar na barra de acoes:

**Botao "Baixar Modelo":**
- Gera um arquivo CSV com cabecalhos:
  `cliente_nome, cliente_email, cliente_cpf, cliente_telefone, cliente_cep, cliente_endereco, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado, cliente_complemento, produto, quantidade, valor, cfop, ncm_sh, cst, unidade, codigo_rastreio`
- Inclui 2 linhas de exemplo preenchidas para referencia
- Download direto via Blob/URL.createObjectURL

**Botao "Importar Planilha":**
- Abre seletor de arquivo (aceita `.csv`)
- Faz parsing do CSV linha a linha (sem dependencia externa, usando split por `;` ou `,`)
- Valida campos obrigatorios (cliente_nome, cliente_email, produto, valor)
- Insere todos os registros validos na tabela `envios` com `loja_id` da loja atual e `status: "pendente"`
- Exibe toast com quantidade importada e erros encontrados

Novo componente: `src/components/envios/ImportarPlanilha.tsx` contendo:
- Logica de parse CSV
- Logica de download do modelo
- Dialog de confirmacao mostrando quantos registros serao importados

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/lib/cep-utils.ts` | Criar - helper fetchCep |
| `src/pages/Empresa.tsx` | Modificar - auto-preenchimento CEP no onBlur |
| `src/components/envios/NovoEnvioWizard.tsx` | Modificar - auto-preenchimento CEP no onBlur |
| `src/components/envios/ImportarPlanilha.tsx` | Criar - componente de importacao CSV |
| `src/pages/Envios.tsx` | Modificar - adicionar botoes de importar e baixar modelo |

