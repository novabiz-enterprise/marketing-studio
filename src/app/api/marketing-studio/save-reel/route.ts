import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deliverableMediaUrl } from '@/lib/public-media-url';
import { putMediaObject } from '@/lib/r2-storage';

export const maxDuration = 60;

function openRouterTaskIdFromDeliverable(url: string): string {
  try {
    const outer = new URL(url, 'http://localhost');
    const sourceUrl = outer.pathname === '/api/download' ? outer.searchParams.get('url') || '' : url;
    const source = new URL(sourceUrl);
    const match = /^\/api\/v1\/videos\/([^/]+)\/content$/.exec(source.pathname);
    return /(^|\.)openrouter\.ai$/.test(source.hostname) ? match?.[1] || '' : '';
  } catch {
    return '';
  }
}

// 保存成片到历史:成片 blob → R2,元数据 → D1 Creation。需登录(未登录不存历史,成片本地仍可看/下)。
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      const reelUrl = deliverableMediaUrl(body.url, req);
      if (!reelUrl) return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
      const title = String(body.title || 'Untitled').slice(0, 500);
      const type = String(body.type || 'marketing-studio');
      const thumbnail = String(body.thumbnail || '') || null;
      const creationId = String(body.creationId || '');
      const outputs = [reelUrl];
      const taskId = openRouterTaskIdFromDeliverable(reelUrl);

      if (creationId) {
        const upd = await prisma.creation.updateMany({
          where: { id: creationId, userId: session.user.id },
          data: { status: 'completed', prompt: title, inputImage: thumbnail, outputs, ...(taskId ? { taskId } : {}) },
        });
        if (upd.count === 1) return NextResponse.json({ id: creationId, url: reelUrl });
      }
      const creation = await prisma.creation.create({
        data: {
          userId: session.user.id,
          templateId: type,
          model: type === 'drama-studio' ? 'drama' : 'marketing',
          prompt: title,
          inputImage: thumbnail,
          status: 'completed',
          ...(taskId ? { taskId } : {}),
          outputs,
        },
      });
      return NextResponse.json({ id: creation.id, url: reelUrl });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
    const buf = await file.arrayBuffer();
    const key = `reel-${crypto.randomUUID()}.mp4`;
    if (!(await putMediaObject(key, buf, 'video/mp4'))) return NextResponse.json({ error: 'no_bucket' }, { status: 500 });
    const reelUrl = `/api/marketing-studio/media/${key}`;

    const title = String(form.get('title') || 'Untitled').slice(0, 500);
    const type = String(form.get('type') || 'marketing-studio');
    const thumbnail = String(form.get('thumbnail') || '') || null;
    const creationId = String(form.get('creationId') || '');
    let shots: string[] = [];
    try { shots = JSON.parse(String(form.get('shots') || '[]')); } catch { /* ignore */ }
    const outputs = [reelUrl, ...shots.filter((s) => typeof s === 'string')];

    // 有 creationId → 更新点生成时创建的占位记录(processing → completed);否则新建(兼容)。
    if (creationId) {
      const upd = await prisma.creation.updateMany({
        where: { id: creationId, userId: session.user.id },
        data: { status: 'completed', prompt: title, inputImage: thumbnail, outputs },
      });
      if (upd.count === 1) return NextResponse.json({ id: creationId, url: reelUrl });
    }
    const creation = await prisma.creation.create({
      data: {
        userId: session.user.id,
        templateId: type,
        model: type === 'drama-studio' ? 'drama' : 'marketing',
        prompt: title,
        inputImage: thumbnail,
        status: 'completed',
        outputs,
      },
    });
    return NextResponse.json({ id: creation.id, url: reelUrl });
  } catch (e) {
    return NextResponse.json({ error: 'save_failed', detail: String(e) }, { status: 502 });
  }
}
