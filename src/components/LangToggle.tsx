'use client';

import { useI18n } from '@/i18n/provider';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/messages';

// Compact language selector for immersive dark pages.
export function LangToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="dark-select cursor-pointer rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white outline-none transition hover:bg-white/15 focus:border-[#7036F0]"
      title="Switch language"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
      ))}
    </select>
  );
}
