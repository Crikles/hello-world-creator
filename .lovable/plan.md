

## Plan: Expandir lista de nomes e CPFs fictícios para 100+

### O que muda
Substituir as 5 entradas atuais de `VIZINHO_NOMES` e `VIZINHO_CPFS` por ~100 nomes brasileiros realistas e CPFs mascarados únicos, nos dois arquivos onde são definidos.

### Alterações

**1. `src/pages/Rastreio.tsx` (linhas 26-27)**
- Substituir os arrays `VIZINHO_NOMES` e `VIZINHO_CPFS` por 100 entradas cada
- Ajustar o módulo no hash: `idx = hash % 100` (ao invés de `% 5`)

**2. `supabase/functions/send-email/index.ts` (linhas 181-182)**
- Mesma substituição dos arrays com 100 entradas
- Ajustar o módulo no hash: `idx = hash % 100`

### Dados
- **Nomes**: 100 nomes brasileiros comuns variados (masculinos e femininos), como "Mariana Oliveira", "Roberto Souza", "Patrícia Lima", etc.
- **CPFs**: 100 CPFs mascarados únicos no formato `***.XXX.XXX-**` com dígitos aleatórios diferentes

### O que não muda
- Lógica de hash determinístico (mesmo envio = mesmo vizinho)
- Toggle `ativar_vizinho`
- Templates de email

