import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const divisionId = searchParams.get('divisionId');

    const where = divisionId ? { divisionId } : {};

    const teams = await prisma.team.findMany({
      where,
      include: {
        division: {
          include: {
            season: true,
          },
        },
        teamPlayers: {
          include: {
            player: true,
          },
        },
        standings: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, divisionId, playerIds } = body;

    if (!name || !divisionId) {
      return NextResponse.json(
        { error: 'Team name and division are required' },
        { status: 400 }
      );
    }

    const team = await prisma.team.create({
      data: {
        name,
        divisionId,
        teamPlayers: playerIds?.length
          ? {
              create: playerIds.map((playerId: string, index: number) => ({
                playerId,
                isCaptain: index === 0,
              })),
            }
          : undefined,
      },
      include: {
        division: true,
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    // Create standing record for this team
    await prisma.standing.create({
      data: {
        teamId: team.id,
        divisionId,
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
