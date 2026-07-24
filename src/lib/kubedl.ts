/**
 * KubeDL admin API client — used by the redeem-code
 * payment adapter. Ported from oss-sponsor/common.py (KubeDLConsole).
 *
 * NOTE: KUBEDL_ADMIN_APIKEY is an admin secret. It is only ever read on
 * the server (route handlers) and never shipped to the browser.
 */
const BASE = (process.env.KUBEDL_ADMIN_BASE || '').replace(/\/$/, '');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': UA,
    Authorization: `Bearer ${process.env.KUBEDL_ADMIN_APIKEY || ''}`,
  };
  return h;
}

export const kubedlConfigured = () => !!process.env.KUBEDL_ADMIN_APIKEY && !!BASE;

/**
 * GET /admin/credit/cdkey/<code> → redemption logs for a code.
 * Returns null if the code does not exist (404), otherwise the log payload.
 * Used to validate that a redeem code is real before granting in-app credits.
 */
export async function cdkeyLogs(code: string): Promise<any | null> {
  const res = await fetch(`${BASE}/admin/credit/cdkey/${encodeURIComponent(code)}`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KubeDL ${res.status}: ${await res.text()}`);
  return res.json();
}
