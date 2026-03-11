

# Corrigir importação de planilhas Zedy (endereço e mapeamento)

## Problema identificado

A planilha da Zedy tem o endereço em um **campo único** `client_address` no formato:
`"Rua Marieta de Castro Santos, 160 - Apto 1302, Morada da Colina, Uberlândia - MG, 38411004"`

O sistema atual não tem esse campo nos aliases e, mesmo que mapeado, seria jogado em um único campo. Além disso, faltam aliases para campos como `client_document`, `client_phone`, `produtos`.

## Solução

### 1. Adicionar aliases faltantes no `ALIAS_MAP`
- `cliente_cpf` ← `"client_document", "document"`
- `cliente_telefone` ← `"client_phone"`
- `produto` ← `"produtos"`
- `valor` ← `"total"`

### 2. Adicionar campo especial `client_address` (endereço completo)
Adicionar um novo alias `"__endereco_completo"` que, ao ser detectado no mapeamento, dispara um **parser de endereço brasileiro** que extrai automaticamente:
- Rua/Logradouro → `cliente_endereco`
- Número → `cliente_numero`
- Complemento → `cliente_complemento`
- Bairro → `cliente_bairro`
- Cidade → `cliente_cidade`
- Estado → `cliente_estado`
- CEP → `cliente_cep`

O parser usa regex no padrão: `"Rua X, NUMERO - COMPLEMENTO, BAIRRO, CIDADE - UF, CEP"`

### 3. Simplificar SYSTEM_FIELDS
Remover os campos fiscais desnecessários (CFOP, NCM, CST, Unidade, Código Rastreio) da lista de mapeamento obrigatório, mantendo apenas os campos do dia-a-dia que o usuário mencionou.

### 4. Auto-detecção do formato Zedy
Adicionar detecção automática: se os headers contêm `client_nome` + `client_address` + `produtos`, reconhecer como formato Zedy, fazer parse do endereço automaticamente e ir direto para o preview (sem modal de mapeamento manual).

## Mudanças

| Arquivo | O quê |
|---|---|
| `src/components/envios/ImportarPlanilha.tsx` | Adicionar aliases, parser de endereço, detecção Zedy, simplificar campos |

