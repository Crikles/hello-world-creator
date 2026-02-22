

## Preencher Chave de Acesso NF-e e Dados do Transportador

### 1. Chave de Acesso NF-e (numero fixo realista)

Substituir o placeholder `0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000` por um numero fixo com formato realista de chave de acesso NF-e (44 digitos), por exemplo:

`3525 0612 3456 7800 0190 5500 1000 0000 0110 0000 0001 `

Isso sera aplicado na linha 139 do arquivo `src/components/danfe/DanfePreview.tsx`.

### 2. Dados do Transportador

Preencher a secao "TRANSPORTADOR / VOLUMES TRANSPORTADOS" (linhas 261-273) com os dados fixos fornecidos:

| Campo | Valor |
|---|---|
| Razao Social | Trans Prada Zibe Transportes e Logistica LTDA |
| Frete por Conta | 0 - REMETENTE (ja preenchido) |
| Placa do Veiculo | FOD9C97 |
| UF (veiculo) | SP |
| CNPJ / CPF | 45.706.927/0001-80 |
| Endereco | Rua Aristeu, 248 |
| Municipio | Sao Paulo |
| UF | SP |
| Inscricao Estadual | 134.607.799.115 |

### Arquivo modificado
- `src/components/danfe/DanfePreview.tsx` - linhas 139 (chave de acesso) e 261-273 (transportador)
