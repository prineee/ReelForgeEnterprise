import { env } from '@/lib/env'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    GROQ_API_KEY:          env.GROQ_API_KEY          ? `SET (${env.GROQ_API_KEY.slice(0, 8)}...)`          : 'MISSING',
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME ? `SET (${env.CLOUDINARY_CLOUD_NAME})`                : 'MISSING',
    CLOUDINARY_API_KEY:    env.CLOUDINARY_API_KEY    ? `SET (${env.CLOUDINARY_API_KEY.slice(0, 6)}...)`    : 'MISSING',
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET ? 'SET'                                               : 'MISSING',
    PIXABAY_API_KEY:       env.PIXABAY_API_KEY        ? 'SET'                                              : 'MISSING',
    PEXELS_API_KEY:        env.PEXELS_API_KEY         ? 'SET'                                              : 'MISSING',
  })
}
