

## Plano: Remover horário dos eventos de rastreio

Remover a exibição de horas nos eventos da timeline de rastreio, mostrando apenas a data (ex: "10/03/2026" em vez de "10/03/2026 23:55").

### Alteração em `src/pages/Rastreio.tsx`

Substituir `toLocaleString` por `toLocaleDateString` (ou formato equivalente sem horas) nos dois blocos de timeline — JADLOG (~linha 346) e JL Transportes (~linha 589) — onde o `eventDate` é formatado para exibição.

