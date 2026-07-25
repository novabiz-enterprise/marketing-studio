'use client';
import { byokHeaders, useByokActive } from '@/lib/byok';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Clapperboard, Download, ImageIcon, Loader2, Sparkles, UploadCloud, Video, Wand2 } from 'lucide-react';
import { mediaDownloadUrl } from '@/lib/media-url';
import { useI18n } from '@/i18n/provider';

const COSTS = { plan: 4 };
// Displayed estimate for the fixed 720p/15s video flow; keep in sync with the backend route.
const VIDEO_COST = 42;
// 语言选择已移除:剧本语种自动跟随产品输入的语言(见 lib/ad-skit.ts planSkit)
const STYLES = [
  { key: 'funny', label: 'Funny meme' }, { key: 'reversal', label: 'Wild plot twist' }, { key: 'skit', label: 'Sitcom skit' },
  { key: 'warm', label: 'Heartwarming' }, { key: 'luxury', label: 'Luxe & premium' }, { key: 'urgent', label: 'Urgent hard sell' },
];
const HERO_BADGES = ['fast', 'product', 'audio'] as const;
const WORKFLOW_STEPS = ['brief', 'script', 'video'] as const;
const SAMPLES = [
  { title: 'Insulated Tumbler', video: '/samples/ad-skit-demo-en.mp4' },
];

type Slot = { status: 'idle' | 'processing' | 'done' | 'failed'; url?: string };
type Plan = { idea: string; productImagePrompt: string; videoPrompt: string; caption: string };

async function imageToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = objectUrl; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(objectUrl); }
}
async function postJson(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...byokHeaders() }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ? `${j.error}${j.detail ? ': ' + String(j.detail).slice(0, 160) : ''}` : `HTTP ${r.status}`);
  return j;
}
function pollCreation(id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let n = 0;
    const t = setInterval(async () => {
      n += 1;
      if (n > 240) { clearInterval(t); reject(new Error('timeout')); return; }
      try {
        const c = await (await fetch(`/api/creations/${id}`, { headers: byokHeaders() })).json();
        if (c.status === 'completed') { clearInterval(t); resolve((Array.isArray(c.outputs) ? c.outputs : [])[0] || ''); }
        else if (c.status === 'failed') { clearInterval(t); reject(new Error('failed')); }
      } catch { /* keep polling */ }
    }, 3000);
  });
}
function errText(code: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (code === 'insufficient_credits') return t('adSkit.errors.insufficientCredits');
  if (code === 'product_required') return t('adSkit.errors.productRequired');
  if (code.startsWith('plan_failed')) {
    if (/401|402|403|429|unauthorized|quota|invalid_api_key/i.test(code)) return t('adSkit.errors.invalidKey');
    return t('adSkit.errors.planFailed');
  }
  if (/401|402|403|429|unauthorized|quota|invalid_api_key/i.test(code)) return t('adSkit.errors.invalidKey');
  if (code.startsWith('submit_failed') || code.startsWith('upload_failed')) return t('adSkit.errors.generationFailed');
  if (code === 'no_product_image') return t('adSkit.errors.productImageFailed');
  if (code === 'timeout' || code === 'failed') return t('adSkit.errors.videoFailed');
  return t('adSkit.errors.somethingWentWrong', { code });
}

export default function AdSkitPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const byokActive = useByokActive();
  const [product, setProduct] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  // 语言选择已移除:自动跟随产品输入的语种
  const [style, setStyle] = useState('funny');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [productImg, setProductImg] = useState<Slot>({ status: 'idle' });
  const [video, setVideo] = useState<Slot>({ status: 'idle' });

  async function genPlan() {
    if (!session) return signIn('google');
    if (product.trim().length < 2) return setErr(t('adSkit.errors.enterProductFirst'));
    setErr(null); setBusy('plan'); setPlan(null); setProductImg({ status: 'idle' }); setVideo({ status: 'idle' });
    try {
      const j = await postJson('/api/ad-skit/plan', { product, styleKey: style });
      setPlan(j.plan);
      window.dispatchEvent(new Event('credits:update'));
    } catch (e) { setErr(errText(e instanceof Error ? e.message : 'failed', t)); }
    setBusy(null);
  }

  async function genVideo() {
    if (!plan) return;
    setErr(null); setBusy('video');
    try {
      let productUrls: string[] = [];
      setProductImg({ status: 'processing' });
      if (uploadedImages.length) {
        productUrls = uploadedImages.filter(Boolean);
        setProductImg({ status: 'done', url: productUrls[0] });
      } else {
        setProductImg({ status: 'idle' });
      }
      setVideo({ status: 'processing' });
      const vj = await postJson('/api/ad-skit/video', { productUrls, videoPrompt: plan.videoPrompt, duration: 15, title: plan.idea });
      const vidUrl = await pollCreation(vj.id);
      setVideo({ status: 'done', url: vidUrl });
      window.dispatchEvent(new Event('credits:update'));
    } catch (e) {
      setProductImg((s) => (s.status === 'processing' ? { status: 'failed' } : s));
      setVideo({ status: 'failed' });
      setErr(errText(e instanceof Error ? e.message : 'failed', t));
    }
    setBusy(null);
  }

  const dl = mediaDownloadUrl;

  return (
    <div className="min-h-screen overflow-hidden bg-[#08090d] text-white" style={{ colorScheme: 'dark' }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(112,54,240,0.28),_transparent_34%),radial-gradient(circle_at_80%_15%,_rgba(255,172,64,0.16),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0))]" />
      <div className="relative z-10 px-6 py-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <a href="/" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white">← {t('adSkit.allApps')}</a>
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8 px-6 pb-16 sm:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#7036F0]/30 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#7036F0]/30 bg-[#7036F0]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#c7b5ff]">
                <Sparkles className="h-3.5 w-3.5" /> {t('adSkit.heroKicker')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#bca8ff]"><Clapperboard className="h-6 w-6" /></span>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{t('adSkit.title')}</h1>
                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-300">{t('adSkit.featured')}</span>
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                {t('adSkit.subtitle')}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {HERO_BADGES.map((badge) => (
                  <span key={badge} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/70">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> {t(`adSkit.badges.${badge}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4 shadow-inner shadow-black/30">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{t('adSkit.workflowTitle')}</p>
              <div className="space-y-3">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7036F0] text-sm font-bold text-white">{index + 1}</span>
                    <span className="text-sm font-medium text-white/80">{t(`adSkit.workflow.${step}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* 左:输入 */}
        <section className="space-y-5">
          <div className="rounded-[1.75rem] border border-white/10 bg-[#14161d]/90 p-5 shadow-xl shadow-black/25 backdrop-blur">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7036F0] text-sm font-bold text-white">1</span>
              <div>
                <h2 className="text-base font-semibold text-white">{t('adSkit.productSettings')}</h2>
                <p className="mt-1 text-xs leading-5 text-white/45">{t('adSkit.styleHint')}</p>
              </div>
            </div>
            <textarea value={product} onChange={(e) => setProduct(e.target.value)} rows={3}
              placeholder={t('adSkit.productPlaceholder')}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-[#7036F0] focus:ring-2 focus:ring-[#7036F0]/30" />
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{t('adSkit.productReferences')}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/45">{uploadedImages.length}/4</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {uploadedImages.map((u, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={t('adSkit.productPhoto')} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setUploadedImages((a) => a.filter((_, j) => j !== i))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] leading-none text-white">×</button>
                  </div>
                ))}
                {uploadedImages.length < 4 && (
                  <label className="flex h-16 min-w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 bg-black/20 px-3 text-center transition hover:border-[#7036F0]/60 hover:bg-[#7036F0]/10">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      const urls = await Promise.all(files.map(imageToDataUrl));
                      setUploadedImages((a) => [...a, ...urls].slice(0, 4));
                    }} />
                    <UploadCloud className="h-5 w-5 text-white/45" />
                    {!uploadedImages.length && <span className="text-[11px] font-medium text-white/45">{t('adSkit.uploadCta')}</span>}
                  </label>
                )}
              </div>
              <span className="mt-1 block text-xs text-white/50">{t('adSkit.uploadHint')}</span>
            </div>
            <div className="mt-4">
              <span className="mb-2 block text-xs font-medium text-white/60">{t('adSkit.style')}</span>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => {
                  const active = style === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStyle(s.key)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${active ? 'border-[#8d66ff] bg-[#7036F0]/25 text-white shadow-lg shadow-[#7036F0]/10' : 'border-white/10 bg-white/[0.035] text-white/60 hover:border-white/20 hover:text-white'}`}
                    >
                      {t(`adSkit.styles.${s.key}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={genPlan} disabled={busy !== null} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7036F0] px-5 py-3.5 font-semibold text-white shadow-lg shadow-[#7036F0]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {busy === 'plan' ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('adSkit.directorThinking')}</> : <><Wand2 className="h-4 w-4" /> {byokActive ? t('adSkit.generateScript') : t('adSkit.generateScriptCredits', { credits: COSTS.plan })}</>}
            </button>
            {err && <p className="mt-3 flex items-center gap-1.5 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" /> {err}</p>}
          </div>

          {plan && (
            <div className="space-y-4 rounded-[1.75rem] border border-[#7036F0]/30 bg-gradient-to-br from-[#7036F0]/20 to-white/[0.04] p-5 shadow-xl shadow-black/25">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7036F0] text-sm font-bold text-white">2</span>{t('adSkit.scriptReview')}</h2>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white/82">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-white/40">{t('adSkit.idea')}</span>
                {plan.idea}
              </div>
              {plan.caption && <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65"><b className="text-white/80">{t('adSkit.caption')}</b>{plan.caption}</p>}
              <button onClick={genVideo} disabled={busy !== null} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-semibold text-[#17151f] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">
                {busy === 'video' ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('adSkit.rendering')}</> : <><Sparkles className="h-4 w-4" /> {byokActive ? t('adSkit.generateAdVideo') : t('adSkit.generateAdVideoCredits', { credits: VIDEO_COST })}</>}
              </button>
            </div>
          )}
        </section>

        {/* 右:输出 */}
        <section className="space-y-5">
          {plan ? (
            <>
              <div className="rounded-[1.75rem] border border-white/10 bg-[#14161d]/90 p-5 shadow-xl shadow-black/25 backdrop-blur">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ImageIcon className="h-4 w-4 text-[#7036F0]" /> {t('adSkit.productPhotoTitle')}</h3>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                  {productImg.status === 'done' && productImg.url ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={productImg.url} alt={t('adSkit.productPhoto')} className="h-full w-full object-contain" />)
                    : productImg.status === 'processing' ? <Loader2 className="h-6 w-6 animate-spin text-[#7036F0]" />
                    : productImg.status === 'failed' ? <span className="text-sm text-red-400">{t('adSkit.productPhotoFailed')}</span>
                    : <span className="text-sm text-white/30">{t('adSkit.appearsAfterVideoClick')}</span>}
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-[#14161d]/90 p-5 shadow-xl shadow-black/25 backdrop-blur">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Video className="h-4 w-4 text-[#7036F0]" /> {t('adSkit.finishedAd')}</h3>
                <div className="mx-auto flex aspect-[9/16] max-h-[560px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
                  {video.status === 'done' && video.url ? <video src={dl(video.url)} controls playsInline className="h-full w-full object-contain" />
                    : video.status === 'processing' ? <div className="flex flex-col items-center gap-2 text-white/40"><Loader2 className="h-7 w-7 animate-spin text-[#7036F0]" /><span className="text-xs">{t('adSkit.videoRendering')}</span></div>
                    : video.status === 'failed' ? <span className="text-sm text-red-400">{t('adSkit.renderFailed')}</span>
                    : <span className="text-sm text-white/30">{t('adSkit.rendersAfterProduct')}</span>}
                </div>
                {video.status === 'done' && video.url && <a href={dl(video.url)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08]"><Download className="h-4 w-4" /> {t('adSkit.downloadVideo')}</a>}
              </div>
            </>
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-[#14161d]/80 p-8 text-center shadow-xl shadow-black/25 backdrop-blur">
              <div className="mx-auto mb-5 flex aspect-[9/16] max-h-[360px] w-full max-w-[210px] flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-white/15 bg-black/25">
                <Clapperboard className="h-10 w-10 text-white/25" />
                <div className="mt-5 h-1.5 w-24 rounded-full bg-white/10" />
                <div className="mt-2 h-1.5 w-16 rounded-full bg-white/10" />
              </div>
              <h3 className="text-base font-semibold text-white/80">{t('adSkit.previewTitle')}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">{t('adSkit.emptyState')}</p>
            </div>
          )}

          {/* 示例 */}
          <div className="rounded-[1.75rem] border border-white/10 bg-[#14161d]/80 p-5 shadow-xl shadow-black/25 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-[#7036F0]" /> {t('adSkit.sampleOutputs')}</h3>
            <div className="flex flex-wrap gap-4">
              {SAMPLES.map((s) => (
                <div key={s.title} className="w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <video src={s.video} controls preload="metadata" playsInline className="aspect-[9/16] w-full bg-neutral-900 object-cover" />
                  <div className="px-2.5 py-1.5 text-xs font-medium text-white/60">{s.title}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
