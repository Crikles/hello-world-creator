const LOGISTICS_DOMAINS = [
  'rastreio.jltransportelogistica.com',
  'rastreio.vetortransportes.com.br'
];

export function isLogisticsDomain(): boolean {
  return LOGISTICS_DOMAINS.includes(window.location.hostname);
}

export function getLogisticsProvider(): string | null {
  const host = window.location.hostname;
  if (host === 'rastreio.vetortransportes.com.br') return 'vetor';
  if (host === 'rastreio.jltransportelogistica.com') return 'jl';
  return null;
}
