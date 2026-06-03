// Allowlist restrita: APENAS estes hosts servem o painel Magnus.
// Qualquer outro host (atlas-cargo.org, vetor, jl, hosts desconhecidos, etc.)
// é tratado como rota pública de rastreio. Default seguro = logística.
const MAGNUS_DOMAINS = [
  'magnusfrete.net',
  'www.magnusfrete.net',
];

function getHost(): string {
  if (typeof window === 'undefined') return '';
  return (window.location.hostname || '').toLowerCase().trim();
}

export function isMagnusDomain(): boolean {
  const host = getHost();
  if (!host) return false;
  if (MAGNUS_DOMAINS.includes(host)) return true;
  // Ambientes internos de desenvolvimento/preview do Lovable
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.lovable.app') || host.endsWith('.lovable.dev')) return true;
  return false;
}

export function isLogisticsDomain(): boolean {
  // Qualquer host que NÃO seja Magnus comprovada é logística.
  return !isMagnusDomain();
}

export function getLogisticsProvider(): string | null {
  const host = getHost();
  if (isMagnusDomain()) return null;

  if (host === 'vetortransportesltda.com' || host === 'www.vetortransportesltda.com') return 'vetor';
  if (host === 'rastreio.jltransportelogistica.com' || host.endsWith('.jltransportelogistica.com')) return 'jl';
  if (host === 'atlas-cargo.org' || host === 'www.atlas-cargo.org' || host.includes('atlas')) return 'atlas';
  if (host.includes('vetor')) return 'vetor';
  if (host.includes('jltransporte')) return 'jl';

  // Fallback seguro: provider genérico atlas (rastreio público).
  return 'atlas';
}
