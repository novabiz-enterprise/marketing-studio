/** OpenRouter clients for chat, image, and video generation. */
import { getRequestOpenRouterKey } from '@/lib/request-context';

const OPENROUTER_BASE = (process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
export const OPENROUTER_VIDEO_MODEL = process.env.OPENROUTER_VIDEO_MODEL || 'alibaba/happyhorse-1.1';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function normalizeProviderKey(raw: string | undefined): string {
  let key = (raw || '').trim();
  if (!key || key === 'null' || key === 'undefined') return '';
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/^Bearer\s+/i, '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

function openRouterApiKey(): string {
  const k = normalizeProviderKey(getRequestOpenRouterKey()) || normalizeProviderKey(process.env.OPENROUTER_API_KEY);
  if (!k) throw new Error('OPENROUTER_API_KEY is not set');
  return k;
}

function openRouterHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${openRouterApiKey()}`,
    'User-Agent': UA,
    'X-OpenRouter-Title': 'InstaTak',
  };
  if (json) headers['Content-Type'] = 'application/json';
  const referer = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL;
  if (referer) headers['HTTP-Referer'] = referer;
  return headers;
}

function urlWithinBase(url: string, base: string, pathPrefix = ''): boolean {
  try {
    const u = new URL(url);
    const b = new URL(base);
    const basePath = b.pathname.replace(/\/+$/, '');
    return u.origin === b.origin && u.pathname.startsWith(`${basePath}${pathPrefix}`);
  } catch {
    return false;
  }
}

function isOpenRouterVideoUrl(url: string): boolean {
  return urlWithinBase(url, OPENROUTER_BASE, '/videos/');
}

export function isProviderPollUrl(url: string): boolean {
  return isOpenRouterVideoUrl(url);
}

export function mediaFetchHeadersForUrl(url: string): Record<string, string> | undefined {
  return isOpenRouterVideoUrl(url) ? openRouterHeaders(false) : undefined;
}

export function isImageReferenceUrl(value: unknown): value is string {
  return typeof value === 'string' && (/^https?:\/\//.test(value) || /^data:image\//.test(value));
}

export interface SubmitResult {
  id: string;
  getUrl: string;
}

const OPENROUTER_VIDEO_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']);
const OPENROUTER_VIDEO_RESOLUTIONS = new Set(['480p', '720p', '1080p']);

function openRouterVideoRatio(value: unknown): string {
  return typeof value === 'string' && OPENROUTER_VIDEO_RATIOS.has(value) ? value : '9:16';
}

function openRouterVideoResolution(value: unknown): string {
  return typeof value === 'string' && OPENROUTER_VIDEO_RESOLUTIONS.has(value) ? value : '720p';
}

function openRouterVideoDuration(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(1, Math.min(15, n)) : 15;
}

export interface OpenRouterVideoInput {
  model?: string;
  prompt: string;
  image?: string;
  referenceImages?: string[];
  duration?: unknown;
  resolution?: unknown;
  aspectRatio?: unknown;
  generateAudio?: boolean;
}

export async function submitOpenRouterVideo(input: OpenRouterVideoInput): Promise<SubmitResult> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('OpenRouter video prompt is required');

  const payload: Record<string, unknown> = {
    model: input.model || OPENROUTER_VIDEO_MODEL,
    prompt,
    duration: openRouterVideoDuration(input.duration),
    resolution: openRouterVideoResolution(input.resolution),
    aspect_ratio: openRouterVideoRatio(input.aspectRatio),
    generate_audio: input.generateAudio ?? true,
  };

  const image = isImageReferenceUrl(input.image) ? input.image : '';
  const refs = (input.referenceImages || []).filter(isImageReferenceUrl).slice(0, 7);
  if (image) {
    payload.frame_images = [{ type: 'image_url', image_url: { url: image }, frame_type: 'first_frame' }];
  } else if (refs.length) {
    payload.input_references = refs.map((url) => ({ type: 'image_url', image_url: { url } }));
  }

  const res = await fetch(`${OPENROUTER_BASE}/videos`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenRouter video ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const id = typeof data?.id === 'string' ? data.id : '';
  const getUrl = typeof data?.polling_url === 'string' ? data.polling_url : id ? `${OPENROUTER_BASE}/videos/${id}` : '';
  if (!id || !getUrl) throw new Error(`OpenRouter video returned no job URL: ${JSON.stringify(data)}`);
  return { id, getUrl };
}

export interface OpenRouterImageInput {
  model?: string;
  prompt: string;
  inputReferences?: string[];
  aspectRatio?: unknown;
  resolution?: unknown;
  quality?: unknown;
}

function openRouterImageAspectRatio(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function openRouterImageResolution(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const v = value.toUpperCase();
  if (v === '2K' || v === '1K' || v === '4K' || v === '512') return v;
  return undefined;
}

export async function submitOpenRouterImage(input: OpenRouterImageInput): Promise<string> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error('OpenRouter image prompt is required');

  const payload: Record<string, unknown> = {
    model: input.model || process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image',
    prompt,
    n: 1,
  };
  const aspectRatio = openRouterImageAspectRatio(input.aspectRatio);
  const resolution = openRouterImageResolution(input.resolution);
  const refs = (input.inputReferences || []).filter(isImageReferenceUrl).slice(0, 14);
  if (aspectRatio) payload.aspect_ratio = aspectRatio;
  if (resolution) payload.resolution = resolution;
  if (typeof input.quality === 'string' && input.quality) payload.quality = input.quality;
  if (refs.length) {
    payload.input_references = refs.map((url) => ({ type: 'image_url', image_url: { url } }));
  }

  const res = await fetch(`${OPENROUTER_BASE}/images`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenRouter image ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const first = Array.isArray(data?.data) ? data.data[0] : undefined;
  if (typeof first?.url === 'string' && first.url) return first.url;
  if (typeof first?.b64_json === 'string' && first.b64_json) {
    const mediaType = typeof first.media_type === 'string' && first.media_type ? first.media_type : 'image/png';
    return `data:${mediaType};base64,${first.b64_json}`;
  }
  throw new Error(`OpenRouter image returned no image: ${JSON.stringify(data).slice(0, 500)}`);
}

async function get(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: openRouterHeaders(false),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(`Provider poll timeout: ${String((e as Error)?.message || e)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Provider poll ${res.status}: ${await res.text()}`);
  return res.json();
}

export type ProviderStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PollResult {
  status: ProviderStatus;
  outputs: string[];
  error?: string;
  raw: any;
}

function outputUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const url = record.url || record.download_url || record.output || record.uri;
  return typeof url === 'string' ? url : '';
}

function errorText(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}

/** One poll request against an OpenRouter video job URL. */
export async function pollOnce(getUrl: string): Promise<PollResult> {
  const r = await get(getUrl);
  const d = r?.data ?? r;
  const rawStatus = String(d?.status ?? 'processing').toLowerCase();
  const status: ProviderStatus =
    rawStatus === 'completed' || rawStatus === 'succeeded' || rawStatus === 'success'
      ? 'completed'
      : rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'canceled' || rawStatus === 'cancelled'
        ? 'failed'
        : rawStatus === 'pending' || rawStatus === 'starting' || rawStatus === 'queued'
          ? 'pending'
          : 'processing';
  const rawOutputs = Array.isArray(d?.outputs)
    ? d.outputs
    : Array.isArray(d?.output)
      ? d.output
      : d?.output
        ? [d.output]
        : Array.isArray(d?.unsigned_urls)
          ? d.unsigned_urls
          : [];
  const outputs = rawOutputs.map(outputUrl).filter(Boolean);
  if (status === 'completed' && !outputs.length && typeof d?.id === 'string') {
    outputs.push(`${OPENROUTER_BASE}/videos/${d.id}/content?index=0`);
  }
  return {
    status,
    outputs,
    error: errorText(d?.error),
    raw: d,
  };
}

export const DEFAULT_CHAT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'qwen/qwen3.7-plus';
const CHAT_TIMEOUT_MS = Number(process.env.OPENROUTER_CHAT_TIMEOUT_MS || 45000);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export async function openRouterChat(
  messages: ChatMessage[],
  model = DEFAULT_CHAT_MODEL,
  maxTokens = 900,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        stream: false,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter chat ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter chat returned empty content');
    return content.trim();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`OpenRouter chat timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
