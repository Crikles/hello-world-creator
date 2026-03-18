const LOGISTICS_DOMAINS = [
  'rastreio.jltransportelogistica.com'
];

export function isLogisticsDomain(): boolean {
  return LOGISTICS_DOMAINS.includes(window.location.hostname);
}
