const LOGISTICS_DOMAINS = [
  'rastreio.logisticajltransportes.com',
  'rastreio.centrojadlog.com'
];

export function isLogisticsDomain(): boolean {
  return LOGISTICS_DOMAINS.includes(window.location.hostname);
}

export function isJadlogDomain(): boolean {
  return window.location.hostname === 'rastreio.centrojadlog.com';
}
