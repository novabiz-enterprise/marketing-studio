import { isImageReferenceUrl, OPENROUTER_VIDEO_MODEL, submitOpenRouterImage, submitOpenRouterVideo } from '@/lib/openrouter';
import type { MarketingPlan, AdShot } from './schema';

/** in-app 积分成本 */
export const MK_PLAN_COST = 3;
export const MK_IMAGE_COST = 5; // 每镜出图,按 nano-banana-2 当前约 $0.08 定价
export const MK_VIDEO_COST = 12; // 每镜视频动态计费,真实扣费见 videoCredits

export const SHOT_IMAGE_MODEL = process.env.MK_SHOT_IMAGE_MODEL || process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3.1-flash-image';
export const SHOT_IMAGE_EDIT_MODEL = process.env.MK_SHOT_IMAGE_EDIT_MODEL || SHOT_IMAGE_MODEL;
export const SHOT_VIDEO_MODEL = process.env.MK_SHOT_VIDEO_MODEL || OPENROUTER_VIDEO_MODEL;
export const REPLICA_VIDEO_MODEL = process.env.MK_REPLICA_VIDEO_MODEL || OPENROUTER_VIDEO_MODEL;
export const SHOT_REF_VIDEO_MODEL = process.env.MK_SHOT_REF_VIDEO_MODEL || OPENROUTER_VIDEO_MODEL;

const RATIOS = new Set(['9:16', '16:9', '1:1', '4:3', '3:4']);
const VIDEO_RATIOS = new Set(['9:16', '16:9', '1:1', '4:3', '3:4', '3:2', '2:3']);
const VIDEO_RESOLUTIONS = new Set(['480p', '720p']);
const VIDEO_DURATIONS = new Set([-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

export function normalizeRatio(v: unknown): string {
  return typeof v === 'string' && RATIOS.has(v) ? v : '9:16';
}
export function normalizeVideoRatio(v: unknown): string {
  return typeof v === 'string' && VIDEO_RATIOS.has(v) ? v : '9:16';
}
export function normalizeVideoResolution(v: unknown): string {
  return typeof v === 'string' && VIDEO_RESOLUTIONS.has(v) ? v : '720p';
}
export function normalizeVideoDuration(v: unknown): number {
  const n = Number(v);
  return VIDEO_DURATIONS.has(n) ? n : 15;
}
export function cleanText(v: unknown, fallback = '', max = 2000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) || fallback : fallback;
}
export function normalizeShotCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(2, Math.min(6, Math.round(n))) : 4;
}

/** 逐镜出图 prompt(无上传图时):靠文字描述锁产品 */
export function buildShotImagePrompt(plan: MarketingPlan, shot: AdShot): string {
  const text = `${plan.scene} ${shot.shot} ${shot.prompt}`.toLowerCase();
  const sceneOnly = text.includes('no presenter') || text.includes('no human') || text.includes('cinematic product scene');
  return [
    `ENGLISH ${plan.ratio} photo, ultra-photorealistic ${sceneOnly ? 'cinematic product advertising' : 'UGC social-media'} style, natural daylight, no filter.`,
    plan.character ? `Person: ${plan.character}.` : '',
    `Product (must look identical in every shot): ${plan.product}.`,
    plan.scene ? `Scene: ${plan.scene}.` : '',
    `Shot: ${shot.shot || 'medium selfie shot holding the product toward the camera'}.`,
    shot.prompt ? `Action and motion intent: ${shot.prompt}.` : '',
    sceneOnly
      ? 'Photorealistic environment, realistic physics, cinematic lighting, no text no watermark no logo.'
      : 'True-to-life skin tone, handheld selfie feel, upper body, no text no watermark no logo.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** 逐镜出图 prompt(有上传的真图时):用输入图里的真实产品/人物,一致性最强 */
export function buildShotImageEditPrompt(plan: MarketingPlan, shot: AdShot, hasProduct: boolean, hasAvatar: boolean): string {
  const text = `${plan.scene} ${shot.shot} ${shot.prompt}`.toLowerCase();
  const wantsPresenter = hasAvatar || !!plan.character;
  const sceneOnly = text.includes('no presenter') || text.includes('no human') || text.includes('cinematic product scene');
  return [
    `ENGLISH ${plan.ratio} ultra-photorealistic UGC social-media photo, natural daylight, no filter.`,
    hasProduct
      ? 'Use the EXACT product shown in the provided product image — keep its shape, color, materials, logo and text pixel-identical, do not redesign it.'
      : `Product: ${plan.product}.`,
    wantsPresenter
      ? (hasAvatar
        ? 'Use the person shown in the provided avatar image as the presenter — keep the same face and identity.'
        : `Presenter: ${plan.character}.`)
      : '',
    wantsPresenter && !sceneOnly
      ? 'Compose them together: the presenter is holding / showing / using this exact product.'
      : 'Place the exact product naturally inside the requested cinematic scene; no presenter or human unless the request explicitly asks for one.',
    plan.scene ? `Scene: ${plan.scene}.` : '',
    `Shot: ${shot.shot || 'medium selfie shot holding the product toward the camera'}.`,
    shot.prompt ? `Action and motion intent: ${shot.prompt}.` : '',
    sceneOnly && !wantsPresenter
      ? 'Photorealistic environment, realistic physics, cinematic lighting, no added text no watermark no logo.'
      : 'Handheld selfie feel, true-to-life skin, upper body, no added text no watermark no logo.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** OpenRouter image generation: references can be HTTPS URLs or data:image base64 URLs. */
export async function submitShotImage(prompt: string, ratio: string, refImages?: string[]) {
  const imgs = (refImages || []).filter(isImageReferenceUrl).slice(0, 14);
  return submitOpenRouterImage({
    model: imgs.length ? SHOT_IMAGE_EDIT_MODEL : SHOT_IMAGE_MODEL,
    prompt,
    inputReferences: imgs,
    aspectRatio: ratio,
    resolution: '2K',
  });
}

/** OpenRouter video image-to-video:首帧字段映射为 frame_images。 */
export async function submitShotVideo(
  imageUrl: string,
  prompt: string,
  opts: { ratio?: unknown; resolution?: unknown; duration?: unknown; model?: string } = {},
) {
  const model = typeof opts.model === 'string' && opts.model ? opts.model : SHOT_VIDEO_MODEL;
  return submitOpenRouterVideo({
    model,
    image: imageUrl,
    prompt,
    duration: normalizeVideoDuration(opts.duration),
    resolution: normalizeVideoResolution(opts.resolution),
    aspectRatio: normalizeVideoRatio(opts.ratio),
    generateAudio: true,
  });
}

/** OpenRouter reference-to-video:多张参考图(产品图/角色定妆图/场景图)直接出视频。 */
export async function submitShotRefVideo(
  referenceImages: string[],
  prompt: string,
  opts: { ratio?: unknown; resolution?: unknown; duration?: unknown } = {},
) {
  const imgs = referenceImages.filter(isImageReferenceUrl).slice(0, 7);
  return submitOpenRouterVideo({
    model: SHOT_REF_VIDEO_MODEL,
    prompt,
    referenceImages: imgs,
    duration: normalizeVideoDuration(opts.duration),
    resolution: normalizeVideoResolution(opts.resolution),
    aspectRatio: normalizeVideoRatio(opts.ratio),
    generateAudio: true,
  });
}
