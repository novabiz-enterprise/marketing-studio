import { withProviderKeys } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const maxDuration = 60;

async function __byokPOST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const uploads: string[] = Array.isArray(body.uploadedImages)
    ? body.uploadedImages.filter((x: unknown) => typeof x === 'string')
    : typeof body.uploadedImage === 'string' && body.uploadedImage
      ? [body.uploadedImage]
      : [];

  // Legacy endpoint kept for cached clients. Uploaded product images now stay as
  // data:image references and go directly to OpenRouter video generation.
  if (uploads.length) {
    const valid = uploads.slice(0, 4);
    if (valid.some((u) => u.length > 8_000_000)) return NextResponse.json({ error: 'image_too_large' }, { status: 400 });
    const productUrls = valid.filter((u) => u.startsWith('data:image/') || /^https?:\/\//.test(u));
    return NextResponse.json({ productUrls });
  }

  return NextResponse.json({ productUrls: [] });
}

export const POST = withProviderKeys(__byokPOST);
