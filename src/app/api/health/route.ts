import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'OK',
    message: 'API routes are working',
    timestamp: new Date().toISOString(),
    env: {
      hasLivekitUrl: !!process.env.LIVEKIT_URL,
      hasLivekitApiKey: !!process.env.LIVEKIT_API_KEY,
      hasLivekitApiSecret: !!process.env.LIVEKIT_API_SECRET,
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      hasPublicLivekitUrl: !!process.env.NEXT_PUBLIC_LIVEKIT_URL,
    },
  });
}

