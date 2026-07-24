'use client';
/**
 * BYOK (bring your own key) — client helper.
 *
 * The user can paste their own AtlasCloud API key; it lives ONLY in this
 * browser's localStorage and rides along on every generation/poll request as
 * the `x-atlas-key` header. When set, the server runs generations on the user's
 * own Atlas account and deducts NO site credits (see src/lib/request-context.ts).
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'atlas_byok_key';
export const BYOK_EVENT = 'byok-change';

function byokEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BYOK === '1' || process.env.NEXT_PUBLIC_ENABLE_BYOK === 'true';
}

export function getByokKey(): string {
  if (!byokEnabled()) return '';
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setByokKey(k: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!byokEnabled()) {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(BYOK_EVENT));
      return;
    }
    const v = k.trim();
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(BYOK_EVENT));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

/** Header bag to spread into fetch(): `{ ...byokHeaders() }`. Empty when no key. */
export function byokHeaders(): Record<string, string> {
  const k = getByokKey();
  return k ? { 'x-atlas-key': k } : {};
}

/**
 * React hook: true when the user has set their own Atlas key. Re-renders on
 * change (save/clear via the BYOK modal). Pages use it to bypass credit gates —
 * BYOK requests bill the user's own account and deduct no site credits.
 */
export function useByokActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!byokEnabled()) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setActive(false);
      return;
    }
    const sync = () => setActive(!!getByokKey());
    sync();
    window.addEventListener(BYOK_EVENT, sync);
    return () => window.removeEventListener(BYOK_EVENT, sync);
  }, []);
  return active;
}
