import { withProviderKeys } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { submitShotImage, normalizeRatio, MK_IMAGE_COST } from '@/lib/marketing-studio/workflow';
import { chargeErrorResponse, chargeSync, refundSync } from '@/lib/marketing-studio/gen-task';

export const maxDuration = 60;

// 剧本分镜出图:OpenRouter Images API 同步返回图片,不再提交异步 image job。
async function __byokPOST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 3000) : '';
  const ratio = normalizeRatio(body.ratio);
  // OpenRouter accepts HTTPS image URLs and data:image base64 references.
  const toAbs = (u: unknown): string => {
    const s = typeof u === 'string' ? u.trim() : '';
    if (s.startsWith('data:image/')) return s;
    if (s.startsWith('/api/marketing-studio/media/')) return new URL(s, req.url).toString();
    return /^https?:\/\//.test(s) ? s : '';
  };
  const refImages = (Array.isArray(body.refImages) ? body.refImages : []).map(toAbs).filter(Boolean) as string[];
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });

  try {
    await chargeSync(uid, MK_IMAGE_COST, 'drama:shot-image');
    try {
      const url = await submitShotImage(prompt, ratio, refImages);
      return NextResponse.json({ url });
    } catch (e) {
      await refundSync(uid, MK_IMAGE_COST, 'drama:shot-image');
      throw e;
    }
  } catch (e) {
    return chargeErrorResponse(e, 'drama/shot-image');
  }
}

export const POST = withProviderKeys(__byokPOST);
