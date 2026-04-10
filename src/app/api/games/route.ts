import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const teamId = searchParams.get('teamId');
    const status = searchParams.get('status');
    const isPlayoff = searchParams.get('isPlayoff');

    const where: Record<string, unknown> = {};
    if (seasonId) where.seasonId = seasonId;
    if (teamId) {
      where.OR = [{ homeTeamId: teamId }, { awayTeamId: teamId }];
    }
    if (status) where.status = status;
    if (isPlayoff !== null) where.isPlayoff = isPlayoff === 'true';

    const games = await prisma.game.findMany({
      where,
      include: {
        homeTeam: {
          include: {
            division: true,
          },
        },
        awayTeam: {
          include: {
            division: true,
          },
        },
        timeSlot: true,
        court: true,
        season: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });
    return NextResponse.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      seasonId,
      homeTeamId,
      awayTeamId,
      scheduledDate,
      timeSlotId,
      courtId,
      isPlayoff,
      playoffRound,
      playoffBracket,
    } = body;

    if (!seasonId || !homeTeamId || !awayTeamId || !scheduledDate) {
      return NextResponse.json(
        { error: 'Season, teams, and date are required' },
        { status: 400 }
      );
    }

    const game = await prisma.game.create({
      data: {
        seasonId,
        homeTeamId,
        awayTeamId,
        scheduledDate: new Date(scheduledDate),
        timeSlotId,
        courtId,
        isPlayoff: isPlayoff || false,
        playoffRound,
        playoffBracket,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        timeSlot: true,
        court: true,
      },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
