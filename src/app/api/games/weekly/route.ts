import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get games grouped by week
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json({ error: 'seasonId is required' }, { status: 400 });
    }

    const games = await prisma.game.findMany({
      where: {
        seasonId,
        isPlayoff: false,
      },
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
        court: true,
        timeSlot: true,
        lineups: {
          include: {
            player: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    // Group games by week
    const gamesByWeek: Record<
      number,
      {
        weekNumber: number;
        weekStart: string;
        games: typeof games;
        totalGames: number;
        completedGames: number;
        confirmedGames: number;
        allConfirmed: boolean;
      }
    > = {};

    games.forEach((game) => {
      // Calculate week number from scheduled date
      const gameDate = new Date(game.scheduledDate);
      const weekNumber = game.weekNumber ?? getWeekNumber(gameDate);

      if (!gamesByWeek[weekNumber]) {
        gamesByWeek[weekNumber] = {
          weekNumber,
          weekStart: gameDate.toISOString(),
          games: [],
          totalGames: 0,
          completedGames: 0,
          confirmedGames: 0,
          allConfirmed: false,
        };
      }

      gamesByWeek[weekNumber].games.push(game);
      gamesByWeek[weekNumber].totalGames++;

      if (game.status === 'completed') {
        gamesByWeek[weekNumber].completedGames++;
      }

      if (game.isConfirmed) {
        gamesByWeek[weekNumber].confirmedGames++;
      }
    });

    // Calculate allConfirmed for each week
    Object.values(gamesByWeek).forEach((week) => {
      week.allConfirmed =
        week.totalGames > 0 &&
        week.completedGames === week.totalGames &&
        week.confirmedGames === week.totalGames;
    });

    // Sort by week number
    const sortedWeeks = Object.values(gamesByWeek).sort(
      (a, b) => a.weekNumber - b.weekNumber
    );

    return NextResponse.json(sortedWeeks);
  } catch (error) {
    console.error('Error fetching weekly games:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly games' }, { status: 500 });
  }
}

// Confirm all games in a week
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seasonId, weekNumber } = body;

    if (!seasonId || weekNumber === undefined) {
      return NextResponse.json(
        { error: 'seasonId and weekNumber are required' },
        { status: 400 }
      );
    }

    // Get all completed games for this week
    const games = await prisma.game.findMany({
      where: {
        seasonId,
        weekNumber,
        status: 'completed',
        isConfirmed: false,
      },
    });

    if (games.length === 0) {
      return NextResponse.json(
        { error: 'No unconfirmed completed games found for this week' },
        { status: 400 }
      );
    }

    // Confirm all games
    await prisma.game.updateMany({
      where: {
        seasonId,
        weekNumber,
        status: 'completed',
        isConfirmed: false,
      },
      data: {
        isConfirmed: true,
        confirmedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Confirmed ${games.length} games for week ${weekNumber}`,
      confirmedCount: games.length,
    });
  } catch (error) {
    console.error('Error confirming weekly games:', error);
    return NextResponse.json({ error: 'Failed to confirm weekly games' }, { status: 500 });
  }
}

// Helper to get week number from date
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const oneWeek = 604800000; // milliseconds in a week
  return Math.ceil(diff / oneWeek);
}
