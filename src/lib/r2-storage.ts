import { getCloudflareContext } from '@opennextjs/cloudflare';

type R2Range = { offset: number; length: number };
type R2HeadLike = { size: number; httpMetadata?: { contentType?: string } };
type R2ObjectLike = { body: ReadableStream; size?: number; httpMetadata?: { contentType?: string } };
type R2BucketLike = {
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  head(key: string): Promise<R2HeadLike | null>;
  get(key: string, opts?: { range?: R2Range }): Promise<R2ObjectLike | null>;
};

export type StoredMediaHead = { size: number; contentType: string };
export type StoredMediaObject = StoredMediaHead & { body: ReadableStream };

type S3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const enc = new TextEncoder();
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function boundBucket(): R2BucketLike | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { MEDIA_BUCKET?: R2BucketLike }).MEDIA_BUCKET;
  } catch {
    return undefined;
  }
}

function s3Config(): S3Config | undefined {
  const bucket = env('R2_BUCKET_NAME', 'R2_BUCKET', 'MEDIA_BUCKET_NAME');
  const accessKeyId = env('R2_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
  const endpoint = env('R2_ENDPOINT') || (env('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID') ? `https://${env('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com` : '');
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) return undefined;
  return { bucket, accessKeyId, secretAccessKey, endpoint: endpoint.replace(/\/+$/, '') };
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: ArrayBuffer | string): Promise<string> {
  const bytes = typeof value === 'string' ? enc.encode(value) : value;
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const rawKey = key instanceof ArrayBuffer ? key : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(value));
}

async function signingKey(secret: string, date: string): Promise<Uint8Array> {
  let key = await hmac(enc.encode(`AWS4${secret}`), date);
  key = await hmac(key, 'auto');
  key = await hmac(key, 's3');
  key = await hmac(key, 'aws4_request');
  return new Uint8Array(key);
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodedKey(key: string): string {
  return key.split('/').map(encodePathPart).join('/');
}

async function signedS3Request(cfg: S3Config, method: 'PUT' | 'GET' | 'HEAD', key: string, opts: { body?: ArrayBuffer; contentType?: string; range?: string } = {}): Promise<Response> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const endpoint = new URL(cfg.endpoint);
  const host = endpoint.host;
  const canonicalUri = `/${encodePathPart(cfg.bucket)}/${encodedKey(key)}`;
  const url = `${cfg.endpoint}${canonicalUri}`;
  const payloadHash = method === 'PUT' && opts.body ? await sha256Hex(opts.body) : EMPTY_SHA256;

  const signed: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (opts.contentType) signed['content-type'] = opts.contentType;
  if (opts.range) signed.range = opts.range;

  const keys = Object.keys(signed).sort();
  const canonicalHeaders = keys.map((k) => `${k}:${signed[k].trim()}\n`).join('');
  const signedHeaders = keys.join(';');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const signature = hex(await hmac(await signingKey(cfg.secretAccessKey, date), stringToSign));

  const headers = new Headers();
  for (const [k, v] of Object.entries(signed)) {
    if (k !== 'host') headers.set(k, v);
  }
  headers.set('Authorization', `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);

  return fetch(url, { method, headers, body: opts.body, cache: 'no-store' });
}

export async function putMediaObject(key: string, value: ArrayBuffer, contentType: string): Promise<boolean> {
  const bucket = boundBucket();
  if (bucket) {
    await bucket.put(key, value, { httpMetadata: { contentType } });
    return true;
  }

  const cfg = s3Config();
  if (!cfg) return false;
  const res = await signedS3Request(cfg, 'PUT', key, { body: value, contentType });
  if (!res.ok) throw new Error(`R2 S3 PUT ${res.status}: ${await res.text()}`);
  return true;
}

export async function headMediaObject(key: string): Promise<StoredMediaHead | null> {
  const bucket = boundBucket();
  if (bucket) {
    const meta = await bucket.head(key);
    return meta ? { size: meta.size, contentType: meta.httpMetadata?.contentType || 'application/octet-stream' } : null;
  }

  const cfg = s3Config();
  if (!cfg) return null;
  const res = await signedS3Request(cfg, 'HEAD', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 S3 HEAD ${res.status}`);
  return {
    size: Number(res.headers.get('content-length') || '0'),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}

export async function getMediaObject(key: string, range?: R2Range): Promise<StoredMediaObject | null> {
  const bucket = boundBucket();
  if (bucket) {
    const obj = await bucket.get(key, range ? { range } : undefined);
    if (!obj) return null;
    return {
      body: obj.body,
      size: range?.length || obj.size || 0,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
    };
  }

  const cfg = s3Config();
  if (!cfg) return null;
  const rangeHeader = range ? `bytes=${range.offset}-${range.offset + range.length - 1}` : undefined;
  const res = await signedS3Request(cfg, 'GET', key, { range: rangeHeader });
  if (res.status === 404) return null;
  if (!res.ok || !res.body) throw new Error(`R2 S3 GET ${res.status}: ${await res.text()}`);
  return {
    body: res.body,
    size: Number(res.headers.get('content-length') || range?.length || '0'),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}
