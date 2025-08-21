import { NextResponse } from 'next/server';

export async function GET() {
  // Only show in development or if explicitly enabled
  const isDev = process.env.NODE_ENV === 'development';
  
  return NextResponse.json({
    environment: process.env.NODE_ENV || 'unknown',
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasJWTSecret: !!process.env.JWT_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL || 'not set',
    openAIKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    timestamp: new Date().toISOString(),
    // Only show sensitive info in development
    ...(isDev && {
      openAIKeyPreview: process.env.OPENAI_API_KEY ? 
        `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'not set',
      nextAuthSecretPreview: process.env.NEXTAUTH_SECRET ? 
        `${process.env.NEXTAUTH_SECRET.substring(0, 10)}...` : 'not set'
    })
  });
} 