const MEDIA_PATH_PREFIX = '/api/marketing-studio/media/';
const DOWNLOAD_PATH = '/api/download';

const PUBLIC_ORIGIN_ENV_KEYS = [
  'PUBLIC_MEDIA_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
  'APP_URL',
  'NEXTAUTH_URL',
] as const;

function cleanOrigin(value: string | undefined): string {
  const s = (value || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function configuredPublicOrigin(): string {
  for (const key of PUBLIC_ORIGIN_ENV_KEYS) {
    const origin = cleanOrigin(process.env[key]);
    if (origin && isPublicHttpUrl(origin)) return origin;
  }
  return '';
}

function originFromRequest(req: Request): string {
  const reqUrl = new URL(req.url);
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host')?.split(',')[0]?.trim();
  if (!host) return reqUrl.origin;
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || reqUrl.protocol.replace(':', '') || 'https';
  return cleanOrigin(`${proto}://${host}`) || reqUrl.origin;
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::1') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  const m = /^172\.(\d+)\./.exec(h);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

export function isPublicHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !isPrivateHostname(u.hostname);
  } catch {
    return false;
  }
}

function publicOriginForRequest(req: Request): string {
  const fromRequest = originFromRequest(req);
  if (isPublicHttpUrl(fromRequest)) return fromRequest;
  return configuredPublicOrigin() || fromRequest;
}

export function sameOriginMediaPath(value: unknown, req: Request): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  if (s.startsWith(MEDIA_PATH_PREFIX)) return s;
  if (!/^https?:\/\//i.test(s)) return '';

  try {
    const u = new URL(s);
    const requestOrigin = new URL(publicOriginForRequest(req)).origin;
    if (u.origin === requestOrigin && u.pathname.startsWith(MEDIA_PATH_PREFIX)) {
      return `${u.pathname}${u.search}`;
    }
  } catch {
    return '';
  }
  return '';
}

function sameOriginOpenRouterProxyPath(value: unknown, req: Request): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';

  let u: URL;
  try {
    if (s.startsWith(DOWNLOAD_PATH)) {
      u = new URL(s, publicOriginForRequest(req));
    } else if (/^https?:\/\//i.test(s)) {
      u = new URL(s);
      const requestOrigin = new URL(publicOriginForRequest(req)).origin;
      if (u.origin !== requestOrigin) return '';
    } else {
      return '';
    }
  } catch {
    return '';
  }

  if (u.pathname !== DOWNLOAD_PATH || u.searchParams.get('proxy') !== '1') return '';
  const proxied = u.searchParams.get('url') || '';
  try {
    const source = new URL(proxied);
    if (!/(^|\.)openrouter\.ai$/.test(source.hostname)) return '';
    if (!/^\/api\/v1\/videos\/[^/]+\/content$/.test(source.pathname)) return '';
    return `${u.pathname}${u.search}`;
  } catch {
    return '';
  }
}

export function deliverableMediaUrl(value: unknown, req: Request): string {
  const path = sameOriginMediaPath(value, req);
  if (path) return path;
  const proxy = sameOriginOpenRouterProxyPath(value, req);
  if (proxy) return proxy;
  const s = typeof value === 'string' ? value.trim() : '';
  return isPublicHttpUrl(s) ? s : '';
}
