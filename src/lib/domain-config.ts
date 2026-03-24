const LOGISTICS_DOMAINS = [
  'rastreio.jltransportelogistica.com',
  'vetortransportesltda.com',
  'www.vetortransportesltda.com'
];

export function isLogisticsDomain(): boolean {
  return LOGISTICS_DOMAINS.includes(window.location.hostname);
}

export function getLogisticsProvider(): string | null {
  const host = window.location.hostname;
  if (host === 'vetortransportesltda.com' || host === 'www.vetortransportesltda.com') return 'vetor';
  if (host === 'rastreio.jltransportelogistica.com') return 'jl';
  return null;
}
