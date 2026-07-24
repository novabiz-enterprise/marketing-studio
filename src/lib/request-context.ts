/**
 * Per-request context (BYOK — bring your own provider keys).
 *
 * A user can paste their own OpenRouter key in the browser; the frontend sends
 * it on generation requests as `x-openrouter-key`.
 *
 * We never persist the key server-side; it lives only in the browser's
 * localStorage and in the per-request AsyncLocalStorage store below.
 *
 * node:async_hooks only exists server-side (workerd via the nodejs_compat flag).
 * Client component graphs can transitively import this module (page → openrouter.ts →
 * here), so the store is created LAZILY and node:async_hooks is aliased away in
 * the client bundle (see next.config.mjs). The client never calls these
 * functions, so the store is never constructed in the browser.
 */
// Bare 'async_hooks' (not 'node:async_hooks'): the node: scheme can't be handled
// by the client webpack pass (UnhandledSchemeError), but a bare specifier
// resolves normally server-side and is aliased to false for the browser bundle
// (see next.config.mjs). workerd (nodejs_compat) resolves it fine at runtime.
// eslint-disable-next-line import/no-nodejs-modules
import { AsyncLocalStorage } from 'async_hooks';

type RequestCtx = { openRouterKey?: string };

let _store: AsyncLocalStorage<RequestCtx> | null = null;
function store(): AsyncLocalStorage<RequestCtx> {
  if (!_store) _store = new AsyncLocalStorage<RequestCtx>();
  return _store;
}

/** Run `fn` with user-supplied provider keys bound to the current async context. */
export function runWithProviderKeys<T>(keys: RequestCtx, fn: () => T): T {
  return store().run({ openRouterKey: keys.openRouterKey || undefined }, fn);
}

/** The user's OpenRouter key for the current request, if they supplied one (BYOK). */
export function getRequestOpenRouterKey(): string | undefined {
  return store().getStore()?.openRouterKey;
}

/** True when the current request is running under a user-supplied key (skip billing). */
export function isByok(): boolean {
  const ctx = store().getStore();
  return !!ctx?.openRouterKey;
}

/** Basic sanity check so we don't forward obvious garbage as a bearer token. */
function sanitizeKey(raw: string | null): string | undefined {
  const k = (raw || '').trim();
  if (!k) return undefined;
  if (k.length < 8 || k.length > 200 || /\s/.test(k)) return undefined;
  return k;
}

/**
 * Wrap a Next.js route handler so any `x-openrouter-key` header is bound to the
 * request context for its whole lifetime. Transparently passes through all
 * handler arguments (req, { params }, ...) and the return value.
 */
export function withProviderKeys<H extends (...args: never[]) => unknown>(handler: H): H {
  return ((...args: never[]) => {
    const req = args[0] as unknown as Request;
    const openRouterKey = sanitizeKey(req?.headers?.get('x-openrouter-key') ?? null);
    return runWithProviderKeys({ openRouterKey }, () => handler(...args));
  }) as H;
}
