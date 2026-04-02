
## Plano: corrigir nome, produto e valor dos leads da Corvex

### O que identifiquei
- O `webhook-corvex` hoje extrai os dados de um formato muito rígido:
  - cliente: `payload.client`
  - itens: `payload.items`
  - valor: `payload.amount`
- No histórico da própria integração já existem variações de payload da Corvex (ex.: eventos antigos com `customer` em vez de `client`).
- Como os dados do lead são gravados direto no `recovery_leads`, qualquer variação ou campo ausente gera nome, produto ou valor incorretos no painel e nas mensagens.

### O que vou ajustar
1. **Fortalecer a normalização no `webhook-corvex`**
   - Criar helpers internos para resolver:
     - cliente a partir de `client` ou `customer`
     - nome/email/telefone/documento com fallbacks seguros
     - produtos com fallback para chaves equivalentes (`name`, `title`, etc.)
     - valor total usando `amount` e, se vier inconsistente, recalculando pela soma dos itens
   - Tratar corretamente números em decimal/cents para evitar valor errado.

2. **Usar a mesma base normalizada em todos os pontos**
   - Aplicar os dados normalizados de forma consistente em:
     - `pedidos`
     - `recovery_leads`
     - `envios`
   - Isso evita divergência entre o pedido salvo, o lead mostrado no painel e o que sai por email/SMS.

3. **Melhorar fallbacks para não gravar dados ruins**
   - Se faltar nome real, tentar derivar do email antes de usar texto genérico.
   - Se faltar produto, montar um fallback legível.
   - Se o total não vier confiável, recalcular pelos itens.

4. **Corrigir os registros já salvos que ficaram errados**
   - Reprocessar os leads recentes da Corvex usando o `raw_payload` já armazenado.
   - Assim o painel passa a mostrar nome, produto e valor corretos também nos leads que já entraram com dado ruim.

5. **Ajustar exibição da tela de Recuperação**
   - Em `src/pages/RecuperacaoVendas.tsx`, adicionar fallback visual para produto/valor quando houver registro antigo incompleto.
   - Isso evita card vazio ou informação quebrada enquanto os dados históricos são corrigidos.

### Validação
- Comparar `raw_payload` x `recovery_leads` x `pedidos` em um PIX novo da Corvex.
- Confirmar no painel:
  - nome do lead correto
  - produto correto
  - valor correto
- Confirmar que email e SMS passam a usar esses mesmos dados corrigidos.

### Arquivos envolvidos
- `supabase/functions/webhook-corvex/index.ts`
- `src/pages/RecuperacaoVendas.tsx`
- Ajuste pontual no banco para corrigir leads já gravados com base no `raw_payload` (sem mudar schema)

### Detalhes técnicos
```text
Hoje:
payload -> leitura direta e rígida
client.name / items[].name / amount

Após ajuste:
payload -> normalizer único
resolve cliente, itens e total com fallbacks
↓
mesmo resultado alimenta pedidos + recovery_leads + envios
↓
painel, email e SMS passam a mostrar os mesmos dados corretos
```

### Observação importante
- Não precisa publicar o frontend para essa correção de captura.
- O ponto principal é atualizar o backend da integração Corvex e validar com um PIX novo.
