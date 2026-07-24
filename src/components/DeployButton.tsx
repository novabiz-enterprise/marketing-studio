'use client';

import { useState } from 'react';
import { Rocket, X } from 'lucide-react';
import { useI18n } from '@/i18n/provider';

const REPO = 'https://github.com/novabiz-enterprise/marketing-studio';
const ENV_VARS = 'OPENROUTER_API_KEY,DATABASE_URL,DIRECT_URL,NEXTAUTH_SECRET,NEXTAUTH_URL,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,PAYMENT_PROVIDER,R2_ACCOUNT_ID,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET_NAME';
const ENV_DESC = 'OpenRouter API key, Neon database URLs, NextAuth secret, Google OAuth credentials, payment provider, and Cloudflare R2 storage (see .dev.vars.example)';
const ENV_LINK = `${REPO}/blob/main/.dev.vars.example`;

const VERCEL_URL =
  `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO)}` +
  `&env=${ENV_VARS}` +
  `&envDescription=${encodeURIComponent(ENV_DESC)}` +
  `&envLink=${encodeURIComponent(ENV_LINK)}` +
  `&project-name=instatak&repository-name=instatak`;
const CF_URL = `https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(REPO)}`;

export function DeployButton() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg transition hover:brightness-110"
        style={{ background: '#7036F0', color: '#fff' }}
        title={t('deploy.title')}
      >
        <Rocket className="w-3.5 h-3.5" /> {t('deploy.button')}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1e21] p-6 text-[#f7f7f8]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold mb-1">{t('deploy.title')}</h3>
            <p className="text-sm text-white/50 mb-5">{t('deploy.desc')}</p>
            <div className="space-y-3">
              <a href={VERCEL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#7036F0]/60 hover:bg-white/[0.06] transition">
                <span className="text-2xl font-black leading-none">▲</span>
                <div><div className="font-semibold">{t('deploy.vercel')}</div><div className="text-xs text-white/45">{t('deploy.vercelDesc')}</div></div>
              </a>
              <a href={CF_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#7036F0]/60 hover:bg-white/[0.06] transition">
                <span className="text-2xl leading-none">☁️</span>
                <div><div className="font-semibold">{t('deploy.cloudflare')}</div><div className="text-xs text-white/45">{t('deploy.cloudflareDesc')}</div></div>
              </a>
            </div>
            <p className="text-[11px] text-white/30 mt-4">{t('deploy.envPrefix')}<a href={ENV_LINK} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">.dev.vars.example</a></p>
          </div>
        </div>
      )}
    </>
  );
}
