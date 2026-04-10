import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const divisionId = searchParams.get('divisionId');

    const where = divisionId ? { divisionId } : {};

    const standings = await prisma.standing.findMany({
      where,
      include: {
        team: {
          include: {
            teamPlayers: {
              include: {
                player: true,
              },
            },
          },
        },
        division: {
          include: {
            season: true,
          },
        },
      },
      orderBy: [
        { wins: 'desc' },
        { pointsFor: 'desc' },
        { pointsAgainst: 'asc' },
      ],
    });

    // Calculate win percentage and point differential
    const enrichedStandings = standings.map((standing) => ({
      ...standing,
      winPercentage:
        standing.wins + standing.losses > 0
          ? (standing.wins / (standing.wins + standing.losses)) * 100
          : 0,
      pointDifferential: standing.pointsFor - standing.pointsAgainst,
    }));

    return NextResponse.json(enrichedStandings);
  } catch (error) {
    console.error('Error fetching standings:', error);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}

// Recalculate standings for a division
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { divisionId } = body;

    if (!divisionId) {
      return NextResponse.json(
        { error: 'Division ID is required' },
        { status: 400 }
      );
    }

    // Get all teams in the division
    const teams = await prisma.team.findMany({
      where: { divisionId },
    });

    // Get all completed games for these teams
    const teamIds = teams.map((t) => t.id);

    for (const team of teams) {
      const homeGames = await prisma.game.findMany({
        where: {
          homeTeamId: team.id,
          status: 'completed',
          homeScore: { not: null },
          awayScore: { not: null },
        },
      });

      const awayGames = await prisma.game.findMany({
        where: {
          awayTeamId: team.id,
          status: 'completed',
          homeScore: { not: null },
          awayScore: { not: null },
        },
      });

      let wins = 0;
      let losses = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      for (const game of homeGames) {
        if (game.homeScore! > game.awayScore!) {
          wins++;
        } else {
          losses++;
        }
        pointsFor += game.homeScore!;
        pointsAgainst += game.awayScore!;
      }

      for (const game of awayGames) {
        if (game.awayScore! > game.homeScore!) {
          wins++;
        } else {
          losses++;
        }
        pointsFor += game.awayScore!;
        pointsAgainst += game.homeScore!;
      }

      await prisma.standing.upsert({
        where: {
          teamId_divisionId: {
            teamId: team.id,
            divisionId,
          },
        },
        update: {
          wins,
          losses,
          pointsFor,
          pointsAgainst,
        },
        create: {
          teamId: team.id,
          divisionId,
          wins,
          losses,
          pointsFor,
          pointsAgainst,
        },
      });
    }

    return NextResponse.json({ message: 'Standings recalculated successfully' });
  } catch (error) {
    console.error('Error recalculating standings:', error);
    return NextResponse.json({ error: 'Failed to recalculate standings' }, { status: 500 });
  }
}
