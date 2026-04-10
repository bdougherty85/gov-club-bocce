import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get availability for a player
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    const where: { playerId: string; seasonId?: string } = { playerId: id };
    if (seasonId) where.seasonId = seasonId;

    const availability = await prisma.playerAvailability.findMany({
      where,
      orderBy: { weekNumber: 'asc' },
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error fetching player availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

// Set availability for a player (bulk update)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { seasonId, weeks } = body;
    // weeks is an array of { weekNumber: number, isAvailable: boolean, notes?: string }

    if (!seasonId || !Array.isArray(weeks)) {
      return NextResponse.json(
        { error: 'seasonId and weeks array are required' },
        { status: 400 }
      );
    }

    // Verify player exists
    const player = await prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Upsert each week's availability
    const results = await Promise.all(
      weeks.map((week: { weekNumber: number; isAvailable: boolean; notes?: string }) =>
        prisma.playerAvailability.upsert({
          where: {
            playerId_seasonId_weekNumber: {
              playerId: id,
              seasonId,
              weekNumber: week.weekNumber,
            },
          },
          update: {
            isAvailable: week.isAvailable,
            notes: week.notes,
          },
          create: {
            playerId: id,
            seasonId,
            weekNumber: week.weekNumber,
            isAvailable: week.isAvailable,
            notes: week.notes,
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error setting player availability:', error);
    return NextResponse.json({ error: 'Failed to set availability' }, { status: 500 });
  }
}

// Update a single week's availability
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { seasonId, weekNumber, isAvailable, notes } = body;

    if (!seasonId || weekNumber === undefined) {
      return NextResponse.json(
        { error: 'seasonId and weekNumber are required' },
        { status: 400 }
      );
    }

    const availability = await prisma.playerAvailability.upsert({
      where: {
        playerId_seasonId_weekNumber: {
          playerId: id,
          seasonId,
          weekNumber,
        },
      },
      update: {
        isAvailable,
        notes,
      },
      create: {
        playerId: id,
        seasonId,
        weekNumber,
        isAvailable,
        notes,
      },
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error updating player availability:', error);
    return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 });
  }
}
