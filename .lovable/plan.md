

# Adicionar TAG de Transportadora nos Envios

## O que será feito
Adicionar um badge/tag visual em cada linha de envio mostrando qual transportadora está vinculada: **JADLOG** (vermelho) ou **JL** (amarelo/dourado).

## Implementação

### Arquivo: `src/pages/Envios.tsx`

Adicionar um `Badge` compacto logo após o nome do produto (ou ao lado do status), usando a coluna `transportadora` que já existe no envio:

- Se `envio.transportadora` contém "JADLOG" → Badge vermelho com texto "JADLOG"
- Caso contrário → Badge dourado com texto "JL"

O badge será pequeno (mesmo estilo do badge de status, ~9px) para manter o layout compacto.

Posição: entre o valor (R$) e a barra de progresso, ou ao lado do status badge — mantendo a linha limpa.

```text
[ ] Nome        produto   R$ 11.00  ── 0/9  ● Pendente  [JL]   🔗 💳 📄 10/03
[ ] Nome        produto   R$ 11.00  ── 3/11 ● Em Trânsito [JADLOG] 🔗 💳 📄 10/03
```

Nenhuma mudança de banco de dados necessária — o campo `transportadora` já está disponível.

