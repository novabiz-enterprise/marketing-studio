import { withProviderKeys } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { marketingPlanSchema } from '@/lib/marketing-studio/schema';
import { buildShotImagePrompt, buildShotImageEditPrompt, normalizeRatio, submitShotImage, MK_IMAGE_COST } from '@/lib/marketing-studio/workflow';
import { chargeErrorResponse, chargeSync, refundSync } from '@/lib/marketing-studio/gen-task';

export const maxDuration = 60;

// OpenRouter image references can be HTTPS URLs or data:image base64 URLs.
function toAbsMedia(v: unknown, base: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('/api/marketing-studio/media/')) return new URL(s, base).toString();
  return /^https?:\/\//.test(s) ? s : '';
}

// 逐镜出图:OpenRouter Images API is synchronous, so no provider job polling is needed.
async function __byokPOST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const parsed = marketingPlanSchema.safeParse(body.plan);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
  const plan = parsed.data;
  const idx = Number(body.shotIndex);
  const shot = Number.isInteger(idx) ? plan.shots[idx] : undefined;
  if (!shot) return NextResponse.json({ error: 'shot_index_out_of_range' }, { status: 400 });

  const ratio = normalizeRatio(plan.ratio);
  // 产品图支持多张(productUrls[]);兼容旧的单 productUrl。avatar 单张。edit 参考图最多 4 张(submitShotImage 会 slice)。
  const rawProducts = Array.isArray(body.productUrls) ? body.productUrls : [body.productUrl];
  const productUrls: string[] = rawProducts.map((u: unknown) => toAbsMedia(u, req.url)).filter(Boolean);
  const avatarUrl = toAbsMedia(body.avatarUrl, req.url);
  // avatar 放最前:多张产品图 + 人像超过 submitShotImage 的 slice(4) 上限时,优先保住人像(否则口播主体丢脸)。
  const refImages = [avatarUrl, ...productUrls].filter(Boolean);
  const useEdit = refImages.length > 0;
  // 复刻模式:前端直传出图 prompt(真人手持该产品的构图),优先于自动构造的 prompt。
  const promptOverride = typeof body.promptOverride === 'string' ? body.promptOverride.trim().slice(0, 3000) : '';
  const base = promptOverride || (useEdit
    ? buildShotImageEditPrompt(plan, shot, productUrls.length > 0, !!avatarUrl)
    : buildShotImagePrompt(plan, shot));
  // 首帧出图硬约束去字幕:promptOverride 常是含台词的口播脚本,edit 会把台词画成对话气泡/字幕,这里强制禁掉。
  const prompt = `${base} ABSOLUTELY NO text of any kind in the image: no speech bubbles, no captions, no subtitles, no dialogue text, no logo, no watermark.`;

  try {
    await chargeSync(uid, MK_IMAGE_COST, 'marketing:shot-image');
    try {
      const url = await submitShotImage(prompt, ratio, refImages);
      return NextResponse.json({ url });
    } catch (e) {
      await refundSync(uid, MK_IMAGE_COST, 'marketing:shot-image');
      throw e;
    }
  } catch (e) {
    return chargeErrorResponse(e, 'marketing/shot-image');
  }
}

export const POST = withProviderKeys(__byokPOST);
