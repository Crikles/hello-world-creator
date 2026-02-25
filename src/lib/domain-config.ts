const LOGISTICS_DOMAINS = [
  'logisticajltransportes.com',
  'www.logisticajltransportes.com',
];

export function isLogisticsDomain(): boolean {
  return LOGISTICS_DOMAINS.includes(window.location.hostname);
}
