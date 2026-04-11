import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  };

  try {
    // Try a simple database query
    const playerCount = await prisma.player.count();
    checks.database = 'connected';
    checks.playerCount = playerCount;
  } catch (error) {
    checks.database = 'error';
    checks.databaseError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(checks);
}
