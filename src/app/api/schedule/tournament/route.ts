import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Round-robin scheduling algorithm for pool play
function generateRoundRobin(teams: string[]): [string, string][][] {
  const n = teams.length;
  const rounds: [string, string][][] = [];

  // If odd number of teams, add a "bye" placeholder
  const teamList = n % 2 === 0 ? [...teams] : [...teams, 'BYE'];
  const numTeams = teamList.length;
  const numRounds = numTeams - 1;
  const halfSize = numTeams / 2;

  const teamIndices = teamList.map((_, i) => i);

  for (let round = 0; round < numRounds; round++) {
    const roundMatches: [string, string][] = [];

    for (let i = 0; i < halfSize; i++) {
      const home = teamIndices[i];
      const away = teamIndices[numTeams - 1 - i];

      // Skip bye games
      if (teamList[home] !== 'BYE' && teamList[away] !== 'BYE') {
        if (round % 2 === 0) {
          roundMatches.push([teamList[home], teamList[away]]);
        } else {
          roundMatches.push([teamList[away], teamList[home]]);
        }
      }
    }

    rounds.push(roundMatches);
    const last = teamIndices.pop()!;
    teamIndices.splice(1, 0, last);
  }

  return rounds;
}

// Generate bracket seeding
function getBracketSeeding(numTeams: number): { home: number; away: number }[] {
  const matchups: { home: number; away: number }[] = [];

  if (numTeams <= 2) {
    return [{ home: 0, away: 1 }];
  }

  const numFirstRoundGames = Math.floor(numTeams / 2);
  const seedOrder = generateSeedOrder(numFirstRoundGames);

  for (let i = 0; i < numFirstRoundGames; i++) {
    const topSeed = seedOrder[i * 2];
    const bottomSeed = seedOrder[i * 2 + 1];
    matchups.push({ home: topSeed, away: bottomSeed });
  }

  return matchups;
}

function generateSeedOrder(numGames: number): number[] {
  const numTeams = numGames * 2;

  if (numGames === 1) {
    return [0, 1];
  }

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

function calculateRounds(numTeams: number): number {
  return Math.ceil(Math.log2(numTeams));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      divisionIds,
      tournamentDate,
      timeSlotIds,
      includePlayoffs = true,
      teamsInPlayoffs = 4,
    } = body;

    // Support both single divisionId and multiple divisionIds
    const divisionIdList = divisionIds || (body.divisionId ? [body.divisionId] : []);

    if (divisionIdList.length === 0 || !tournamentDate) {
      return NextResponse.json(
        { error: 'At least one division and tournament date are required' },
        { status: 400 }
      );
    }

    if (!timeSlotIds || timeSlotIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one time slot is required' },
        { status: 400 }
      );
    }

    // Get all divisions with their teams
    const divisions = await prisma.division.findMany({
      where: { id: { in: divisionIdList } },
      include: {
        teams: true,
        season: true,
      },
    });

    if (divisions.length === 0) {
      return NextResponse.json({ error: 'No divisions found' }, { status: 404 });
    }

    // Get the time slots sorted by time
    const timeSlots = await prisma.timeSlot.findMany({
      where: { id: { in: timeSlotIds } },
      include: { court: true },
      orderBy: { startTime: 'asc' },
    });

    if (timeSlots.length === 0) {
      return NextResponse.json(
        { error: 'No valid time slots found' },
        { status: 400 }
      );
    }

    // Parse the tournament date (avoid timezone issues)
    const [year, month, day] = tournamentDate.split('-').map(Number);
    const gameDate = new Date(year, month - 1, day, 12, 0, 0);

    // Collect all pool play games across all divisions
    const allPoolGames: { home: string; away: string; seasonId: string; divisionName: string }[] = [];

    for (const division of divisions) {
      if (division.teams.length < 2) continue;

      const teamIds = division.teams.map((t) => t.id);
      const rounds = generateRoundRobin(teamIds);

      rounds.forEach((round) => {
        round.forEach(([home, away]) => {
          allPoolGames.push({
            home,
            away,
            seasonId: division.seasonId,
            divisionName: division.name,
          });
        });
      });
    }

    if (allPoolGames.length === 0) {
      return NextResponse.json(
        { error: 'No games to schedule (divisions need at least 2 teams each)' },
        { status: 400 }
      );
    }

    const games = [];
    let slotIndex = 0;

    // Assign pool play games to time slots (round-robin through slots)
    for (const poolGame of allPoolGames) {
      const currentSlot = timeSlots[slotIndex % timeSlots.length];

      const createdGame = await prisma.game.create({
        data: {
          seasonId: poolGame.seasonId,
          homeTeamId: poolGame.home,
          awayTeamId: poolGame.away,
          scheduledDate: gameDate,
          timeSlotId: currentSlot.id,
          courtId: currentSlot.courtId,
          weekNumber: 1,
          isPlayoff: false,
          status: 'scheduled',
        },
      });
      games.push(createdGame);
      slotIndex++;
    }

    let playoffGames = 0;

    // Generate playoff bracket if requested
    if (includePlayoffs && teamsInPlayoffs >= 2) {
      // Collect all teams across divisions for playoffs
      const allTeams = divisions.flatMap((d) => d.teams);
      const seasonId = divisions[0].seasonId;

      if (allTeams.length >= 2) {
        const numTeamsForPlayoffs = Math.min(teamsInPlayoffs, allTeams.length);
        const numRounds = calculateRounds(numTeamsForPlayoffs);
        const seededTeams = allTeams.slice(0, numTeamsForPlayoffs);

        // Create playoff games using remaining time slots
        const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();

        for (let round = numRounds; round >= 1; round--) {
          const gamesInRound = Math.pow(2, numRounds - round);
          const roundGames: { id: string; position: number }[] = [];

          for (let position = 0; position < gamesInRound; position++) {
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

            let homeTeamId: string | null = null;
            let awayTeamId: string | null = null;

            if (round === 1) {
              const bracketPositions = getBracketSeeding(numTeamsForPlayoffs);
              const matchup = bracketPositions[position];
              if (matchup) {
                homeTeamId = seededTeams[matchup.home]?.id || null;
                awayTeamId = seededTeams[matchup.away]?.id || null;
              }
            }

            // Use time slots for playoff rounds
            const slotForRound = timeSlots[(slotIndex + round - 1) % timeSlots.length];

            const game = await prisma.game.create({
              data: {
                seasonId,
                homeTeamId,
                awayTeamId,
                scheduledDate: gameDate,
                timeSlotId: slotForRound.id,
                courtId: slotForRound.courtId,
                isPlayoff: true,
                playoffRound: round,
                playoffPosition: position,
                nextGameId,
                nextGamePosition,
                status: 'scheduled',
              },
            });

            roundGames.push({ id: game.id, position });
            playoffGames++;
          }

          gamesByRound.set(round, roundGames);
        }
      }
    }

    const divisionNames = divisions.map((d) => d.name).join(', ');

    return NextResponse.json({
      message: `Tournament created for ${divisionNames}: ${games.length} pool play games${playoffGames > 0 ? ` and ${playoffGames} playoff games` : ''}`,
      poolGamesCreated: games.length,
      playoffGamesCreated: playoffGames,
      totalGames: games.length + playoffGames,
      divisions: divisions.length,
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
