const LOGISTICS_DOMAINS = [
  'rastreio.logisticajltransportes.com'
];

export function isLogisticsDomain(): boolean {
  return LOGISTICS_DOMAINS.includes(window.location.hostname);
}
