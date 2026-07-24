import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST() {
  return NextResponse.json(
    { error: 'openrouter_only', detail: 'The legacy ad-reference motion provider has been disabled. Use OpenRouter video flows instead.' },
    { status: 501 },
  );
}
