## Plano

1. Ajustar a composição visual de cada marcador no globo para que a bolinha vermelha e o badge façam parte do mesmo elemento ancorado ao mesmo ponto projetado, eliminando o efeito de bolinha em um lugar e texto em outro.
2. Trocar o posicionamento do badge para um layout organizado no estilo da referência: ponto vermelho no local exato do visitante e card curto deslocado lateralmente a partir desse mesmo ponto, com linha visual consistente e sem desalinhamento ao rotacionar o globo.
3. Enriquecer os dados do visitante ao vivo para exibir a cidade do cliente quando ela existir no envio associado ao código de rastreio; se não existir, usar a melhor origem disponível nesta ordem: cidade do ping, cidade do envio, país legível.
4. Manter atualização em tempo real: cada novo visitante online entra imediatamente no globo com seu ponto e seu badge, sem esperar nova montagem do componente.
5. Preservar o visual atual do globo branco com fundo escuro, mas migrar os estilos do marcador para tokens semânticos do design system onde for aplicável.

## Resultado esperado

- Cada visitante online aparece com um único marcador visual coerente.
- A bolinha vermelha fica colada ao ponto do globo.
- O badge aparece organizado ao lado dela.
- O texto mostra a cidade do cliente quando disponível.
- Novos visitantes entram em tempo real sem sumir ou quebrar o alinhamento.

## Detalhes técnicos

- Atualizar `src/components/ui/logistics-globe.tsx` para renderizar um wrapper por marcador contendo:
  - ponto vermelho
  - haste/offset visual opcional
  - badge com `LIVE`, cidade e contagem
- Recalcular a projeção 2D aplicando transform no wrapper único do marcador, em vez de mover apenas o texto.
- Atualizar `src/hooks/useLiveVisitorsRealtime.ts` para enriquecer os marcadores com label mais fiel ao cliente, buscando a cidade do envio associada ao `codigo_rastreio` durante o refresh dos pings.
- Manter fallback determinístico quando não houver coordenadas precisas, mas sem perder o nome exibido.
- Validar que o componente continue compilando e que o fluxo em tempo real permaneça responsivo.