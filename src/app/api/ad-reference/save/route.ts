import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deliverableMediaUrl, sameOriginMediaPath } from '@/lib/public-media-url';

export const maxDuration = 30;

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

// 保存爆款复刻最终成片到历史。编辑/配音/对口型中间任务各自落库但会被历史面板隐藏。
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const outputUrl = deliverableMediaUrl(body.outputUrl, req);
  if (!outputUrl) return NextResponse.json({ error: 'invalid_output_url' }, { status: 400 });

  const thumbnail = sameOriginMediaPath(body.thumbnail, req) || null;
  const title = (typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Reference to Ad').slice(0, 500);
  const taskId = openRouterTaskIdFromDeliverable(outputUrl);

  const creationId = typeof body.creationId === 'string' ? body.creationId : '';
  if (creationId) {
    const upd = await prisma.creation.updateMany({
      where: { id: creationId, userId: session.user.id },
      data: { status: 'completed', prompt: title, inputImage: thumbnail, outputs: [outputUrl], ...(taskId ? { taskId } : {}) },
    });
    if (upd.count === 1) return NextResponse.json({ id: creationId, url: outputUrl });
  }

  const creation = await prisma.creation.create({
    data: {
      userId: session.user.id,
      templateId: 'ad-reference',
      model: 'ad-reference',
      prompt: title,
      inputImage: thumbnail,
      status: 'completed',
      ...(taskId ? { taskId } : {}),
      outputs: [outputUrl],
    },
  });

  return NextResponse.json({ id: creation.id, url: outputUrl });
}
