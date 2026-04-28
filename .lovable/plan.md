## Plano

Vou corrigir o Live View para que os marcadores fiquem realmente espalhados pelo globo, sem empilhar uns sobre os outros.

### O que será feito
1. Remover a lógica atual que sobrescreve todas as posições dentro do Brasil no componente do globo.
2. Usar a posição já resolvida no hook de dados como fonte única da verdade para cada visitante/marcador.
3. Ajustar a distribuição fallback para visitantes sem latitude/longitude real, espalhando os pontos por regiões plausíveis do globo em vez de concentrar tudo na mesma área.
4. Tornar os IDs dos marcadores estáveis para evitar reposicionamentos errados entre renderizações.
5. Adicionar um tratamento visual simples contra sobreposição de badges, deslocando labels vizinhas quando os pontos ficarem muito próximos.
6. Manter cidade/estado no texto do badge, mas sem deixar o layout “colar” um no outro.

### Resultado esperado
- Pontos visivelmente distribuídos pelo globo.
- Badges menos sobrepostos.
- Posições consistentes entre atualizações em tempo real.
- Sem depender de geolocalização exata para parecer correto visualmente.

### Detalhes técnicos
- `src/components/ui/logistics-globe.tsx`
  - remover o `useMemo` que recalcula `displayMarkers` forçando coordenadas aleatórias no Brasil;
  - renderizar diretamente `markers` recebidos;
  - aplicar uma pequena lógica de separação visual entre badges próximos na projeção 2D.
- `src/hooks/useLiveVisitorsRealtime.ts`
  - revisar `resolveMarkerLocation` para fallback global mais bem distribuído;
  - preservar distribuição determinística por sessão/código, sem concentrar vários visitantes no mesmo cluster.
- `src/pages/LiveView.tsx`
  - estabilizar os IDs dos marcadores para não depender de índice da lista.

### Validação
- Conferir que múltiplos visitantes aparecem em regiões diferentes do globo.
- Verificar que os badges continuam presos aos pontos corretos.
- Confirmar que atualizações em tempo real não fazem os pontos “saltarem” ou se sobreporem excessivamente.