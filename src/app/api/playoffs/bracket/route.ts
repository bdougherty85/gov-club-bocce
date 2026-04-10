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
  nextGameId: string | null;
  nextGamePosition: string | null;
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
        { playoffPosition: 'asc' },
      ],
    });

    // Get settings for playoff format
    const settings = await prisma.settings.findFirst();
    const format = settings?.playoffFormat || 'single';

    // Organize games into bracket structure
    const bracketGames: BracketGame[] = games.map((game) => ({
      id: game.id,
      round: game.playoffRound || 1,
      position: game.playoffPosition || 0,
      homeTeam: game.homeTeam ? { id: game.homeTeam.id, name: game.homeTeam.name } : null,
      awayTeam: game.awayTeam ? { id: game.awayTeam.id, name: game.awayTeam.name } : null,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      winner: game.homeScore !== null && game.awayScore !== null
        ? game.homeScore > game.awayScore
          ? game.homeTeam ? { id: game.homeTeam.id, name: game.homeTeam.name } : null
          : game.awayTeam ? { id: game.awayTeam.id, name: game.awayTeam.name } : null
        : null,
      bracket: game.playoffBracket as 'winners' | 'losers' | null,
      nextGameId: game.nextGameId,
      nextGamePosition: game.nextGamePosition,
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

// Calculate number of rounds needed for N teams
function calculateRounds(numTeams: number): number {
  return Math.ceil(Math.log2(numTeams));
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

    // Delete existing playoff games for this season
    await prisma.game.deleteMany({
      where: {
        seasonId,
        isPlayoff: true,
      },
    });

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
    const numRounds = calculateRounds(numTeams);

    // Get the season to determine playoff start date
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    const playoffStartDate = season?.endDate || new Date();

    // For single elimination, create all games for all rounds
    // Start from the finals and work backwards so we can link games properly
    const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();

    // Create games starting from last round (finals) to first round
    for (let round = numRounds; round >= 1; round--) {
      const gamesInRound = Math.pow(2, numRounds - round);
      const roundGames: { id: string; position: number }[] = [];

      for (let position = 0; position < gamesInRound; position++) {
        // Determine which game this feeds into (next round)
        let nextGameId: string | null = null;
        let nextGamePosition: 'home' | 'away' | null = null;

        if (round < numRounds) {
          const nextRoundGames = gamesByRound.get(round + 1);
          if (nextRoundGames) {
            const nextGameIndex = Math.floor(position / 2);
            nextGameId = nextRoundGames[nextGameIndex]?.id || null;
            nextGamePosition = position % 2 === 0 ? 'home' : 'away';
          }
        }

        // For first round, assign teams based on seeding
        let homeTeamId: string | null = null;
        let awayTeamId: string | null = null;

        if (round === 1) {
          // Standard bracket seeding: 1v8, 4v5, 2v7, 3v6 for 8 teams
          const bracketPositions = getBracketSeeding(numTeams);
          const matchup = bracketPositions[position];
          if (matchup) {
            homeTeamId = seededTeams[matchup.home]?.id || null;
            awayTeamId = seededTeams[matchup.away]?.id || null;
          }
        }

        // Calculate scheduled date (space rounds out by days)
        const gameDate = new Date(playoffStartDate);
        gameDate.setDate(gameDate.getDate() + (round - 1) * 7); // One week between rounds

        const game = await prisma.game.create({
          data: {
            seasonId,
            homeTeamId,
            awayTeamId,
            scheduledDate: gameDate,
            isPlayoff: true,
            playoffRound: round,
            playoffPosition: position,
            playoffBracket: format === 'double' ? 'winners' : null,
            nextGameId,
            nextGamePosition,
            status: 'scheduled',
          },
        });

        roundGames.push({ id: game.id, position });
      }

      gamesByRound.set(round, roundGames);
    }

    // Count total games created
    const totalGames = Array.from(gamesByRound.values()).reduce(
      (sum, games) => sum + games.length,
      0
    );

    return NextResponse.json({
      message: `Created ${totalGames} playoff games across ${numRounds} rounds`,
      rounds: numRounds,
      teamsSeeded: numTeams,
    });
  } catch (error) {
    console.error('Error generating bracket:', error);
    return NextResponse.json({ error: 'Failed to generate bracket' }, { status: 500 });
  }
}

// Get bracket seeding for proper matchups (1v8, 4v5, 2v7, 3v6 for 8 teams)
function getBracketSeeding(numTeams: number): { home: number; away: number }[] {
  const matchups: { home: number; away: number }[] = [];

  if (numTeams <= 2) {
    return [{ home: 0, away: 1 }];
  }

  // Standard bracket seeding ensures top seeds don't meet until later rounds
  // For 8 teams: (1v8, 4v5), (2v7, 3v6) - winners of adjacent matches play each other
  const numFirstRoundGames = Math.floor(numTeams / 2);

  // Create seeding order that follows standard tournament brackets
  const seedOrder = generateSeedOrder(numFirstRoundGames);

  for (let i = 0; i < numFirstRoundGames; i++) {
    const topSeed = seedOrder[i * 2];
    const bottomSeed = seedOrder[i * 2 + 1];
    matchups.push({
      home: topSeed,
      away: bottomSeed,
    });
  }

  return matchups;
}

// Generate seed order for bracket (ensures 1v8, 4v5, 3v6, 2v7 type seeding)
function generateSeedOrder(numGames: number): number[] {
  const numTeams = numGames * 2;

  if (numGames === 1) {
    return [0, 1];
  }

  // Standard bracket seeding algorithm
  // Results in: 1v8, 4v5, 3v6, 2v7 for 8 teams
  const seeds: number[] = [];

  function fillBracket(position: number, size: number, seed: number) {
    if (size === 1) {
      seeds[position] = seed;
      return;
    }
    fillBracket(position, size / 2, seed);
    fillBracket(position + size / 2, size / 2, size * 2 - seed - 1);
  }

  fillBracket(0, numTeams, 0);

  return seeds;
}
