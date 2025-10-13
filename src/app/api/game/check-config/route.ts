import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    openaiKey: !!process.env.OPENAI_API_KEY,
    openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    openaiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 7) || 'Not set',
    livekitUrl: !!process.env.LIVEKIT_URL,
    livekitApiKey: !!process.env.LIVEKIT_API_KEY,
    livekitApiSecret: !!process.env.LIVEKIT_API_SECRET,
  };

  const allConfigured = checks.openaiKey && checks.livekitUrl && checks.livekitApiKey && checks.livekitApiSecret;

  return NextResponse.json({
    status: allConfigured ? 'OK' : 'INCOMPLETE',
    checks,
    message: allConfigured 
      ? 'All environment variables are configured' 
      : 'Some environment variables are missing. Please check your .env.local file.',
    missingVars: [
      !checks.openaiKey && 'OPENAI_API_KEY',
      !checks.livekitUrl && 'LIVEKIT_URL',
      !checks.livekitApiKey && 'LIVEKIT_API_KEY',
      !checks.livekitApiSecret && 'LIVEKIT_API_SECRET',
    ].filter(Boolean),
  });
}

