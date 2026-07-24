import { withProviderKeys } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const maxDuration = 60;

// Legacy endpoint kept for cached clients. Images are no longer uploaded;
// OpenRouter accepts data:image references directly.
async function __byokPOST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  if (!dataUrl.startsWith('data:image/')) return NextResponse.json({ error: 'invalid_image' }, { status: 400 });
  if (dataUrl.length > 8_000_000) return NextResponse.json({ error: 'image_too_large' }, { status: 400 });

  return NextResponse.json({ url: dataUrl });
}

export const POST = withProviderKeys(__byokPOST);
