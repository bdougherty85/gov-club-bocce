import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface BracketGame {
  id: string | null;
  round: number;
  position: number;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: { id: string; name: string } | null;
  bracket: 'winners' | 'losers' | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json({ error: 'Season ID is required' }, { status: 400 });
    }

    // Get playoff games for this season
    const games = await prisma.game.findMany({
      where: {
        seasonId,
        isPlayoff: true,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: [
        { playoffRound: 'asc' },
        { playoffBracket: 'asc' },
      ],
    });

    // Get settings for playoff format
    const settings = await prisma.settings.findFirst();
    const format = settings?.playoffFormat || 'single';

    // Organize games into bracket structure
    const bracketGames: BracketGame[] = games.map((game, index) => ({
      id: game.id,
      round: game.playoffRound || 1,
      position: index,
      homeTeam: game.homeTeam ? { id: game.homeTeam.id, name: game.homeTeam.name } : null,
      awayTeam: game.awayTeam ? { id: game.awayTeam.id, name: game.awayTeam.name } : null,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      winner: game.homeScore !== null && game.awayScore !== null
        ? game.homeScore > game.awayScore
          ? { id: game.homeTeam!.id, name: game.homeTeam!.name }
          : { id: game.awayTeam!.id, name: game.awayTeam!.name }
        : null,
      bracket: game.playoffBracket as 'winners' | 'losers' | null,
    }));

    return NextResponse.json({
      format,
      games: bracketGames,
    });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    return NextResponse.json({ error: 'Failed to fetch bracket' }, { status: 500 });
  }
}

// Generate playoff bracket based on standings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seasonId, divisionIds } = body;

    if (!seasonId || !divisionIds || divisionIds.length === 0) {
      return NextResponse.json(
        { error: 'Season ID and division IDs are required' },
        { status: 400 }
      );
    }

    const settings = await prisma.settings.findFirst();
    const teamsInPlayoffs = settings?.teamsInPlayoffs || 8;
    const format = settings?.playoffFormat || 'single';

    // Get top teams from each division
    const standings = await prisma.standing.findMany({
      where: {
        divisionId: { in: divisionIds },
      },
      include: {
        team: true,
        division: true,
      },
      orderBy: [
        { wins: 'desc' },
        { pointsFor: 'desc' },
      ],
      take: teamsInPlayoffs,
    });

    if (standings.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams for playoffs' },
        { status: 400 }
      );
    }

    // Seed teams (1 vs last, 2 vs second-to-last, etc.)
    const seededTeams = standings.map((s) => s.team);
    const numTeams = seededTeams.length;
    const games: { homeTeamId: string; awayTeamId: string; round: number; position: number }[] = [];

    // Create first round matchups
    for (let i = 0; i < Math.floor(numTeams / 2); i++) {
      games.push({
        homeTeamId: seededTeams[i].id,
        awayTeamId: seededTeams[numTeams - 1 - i].id,
        round: 1,
        position: i,
      });
    }

    // Get the season to determine playoff start date
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    const playoffStartDate = season?.endDate || new Date();

    // Create the games in the database
    const createdGames = [];
    for (const game of games) {
      const createdGame = await prisma.game.create({
        data: {
          seasonId,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          scheduledDate: playoffStartDate,
          isPlayoff: true,
          playoffRound: game.round,
          playoffBracket: format === 'double' ? 'winners' : null,
        },
      });
      createdGames.push(createdGame);
    }

    return NextResponse.json({
      message: `Created ${createdGames.length} playoff games`,
      games: createdGames,
    });
  } catch (error) {
    console.error('Error generating bracket:', error);
    return NextResponse.json({ error: 'Failed to generate bracket' }, { status: 500 });
  }
}
