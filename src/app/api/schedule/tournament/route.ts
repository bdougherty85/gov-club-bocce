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
      divisionId,
      tournamentDate,
      timeSlotIds,
      includePlayoffs = true,
      teamsInPlayoffs = 4,
      playoffTimeSlotIds = [],
      minutesBetweenRounds = 60,
    } = body;

    if (!divisionId || !tournamentDate) {
      return NextResponse.json(
        { error: 'Division ID and tournament date are required' },
        { status: 400 }
      );
    }

    if (!timeSlotIds || timeSlotIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one time slot is required' },
        { status: 400 }
      );
    }

    // Get the division with its teams
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        teams: true,
        season: true,
      },
    });

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }

    if (division.teams.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams to create a tournament' },
        { status: 400 }
      );
    }

    // Get the time slots
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

    const teamIds = division.teams.map((t) => t.id);
    const rounds = generateRoundRobin(teamIds);

    // Calculate how many games can be played per time slot
    // (number of courts available)
    const courtsPerSlot = timeSlots.filter(ts => ts.court).length || 1;

    // Flatten all games for pool play
    const allPoolGames: { home: string; away: string; round: number }[] = [];
    rounds.forEach((round, roundIndex) => {
      round.forEach(([home, away]) => {
        allPoolGames.push({ home, away, round: roundIndex + 1 });
      });
    });

    const games = [];
    let gameIndex = 0;
    let slotIndex = 0;

    // Assign pool play games to time slots
    while (gameIndex < allPoolGames.length && slotIndex < timeSlots.length) {
      const currentSlot = timeSlots[slotIndex];

      // Assign one game per court in this time slot
      const game = allPoolGames[gameIndex];

      const createdGame = await prisma.game.create({
        data: {
          seasonId: division.seasonId,
          homeTeamId: game.home,
          awayTeamId: game.away,
          scheduledDate: gameDate,
          timeSlotId: currentSlot.id,
          courtId: currentSlot.courtId,
          weekNumber: 1, // Tournament is week 1
          isPlayoff: false,
          status: 'scheduled',
        },
      });
      games.push(createdGame);
      gameIndex++;

      // Move to next slot after using this one
      // (In a multi-court setup, you might want to use all courts in a slot)
      slotIndex++;

      // If we've used all slots but have more games, cycle back
      if (slotIndex >= timeSlots.length && gameIndex < allPoolGames.length) {
        slotIndex = 0;
      }
    }

    let playoffGames = 0;

    // Generate playoff bracket if requested
    if (includePlayoffs && teamsInPlayoffs >= 2) {
      // Get playoff time slots or use remaining regular time slots
      let bracketSlots = playoffTimeSlotIds.length > 0
        ? await prisma.timeSlot.findMany({
            where: { id: { in: playoffTimeSlotIds } },
            include: { court: true },
            orderBy: { startTime: 'asc' },
          })
        : timeSlots.slice(Math.min(slotIndex, timeSlots.length - 1));

      if (bracketSlots.length === 0) {
        bracketSlots = timeSlots;
      }

      const numTeamsForPlayoffs = Math.min(teamsInPlayoffs, teamIds.length);
      const numRounds = calculateRounds(numTeamsForPlayoffs);

      // For seeding, we'll use team order (in a real scenario, use standings)
      const seededTeams = division.teams.slice(0, numTeamsForPlayoffs);

      // Create playoff games (single elimination)
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();

      // Parse playoff start time from first bracket slot
      const firstBracketSlot = bracketSlots[0];
      const [startHour, startMinute] = firstBracketSlot.startTime.split(':').map(Number);

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

          // Calculate game time based on round (add minutes between rounds)
          const roundOffset = (round - 1) * minutesBetweenRounds;
          const gameDateTime = new Date(gameDate);
          gameDateTime.setHours(startHour, startMinute + roundOffset, 0, 0);

          // Use appropriate time slot for this round
          const slotForRound = bracketSlots[Math.min(round - 1, bracketSlots.length - 1)];

          const game = await prisma.game.create({
            data: {
              seasonId: division.seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: gameDateTime,
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

    return NextResponse.json({
      message: `Tournament created: ${games.length} pool play games${playoffGames > 0 ? ` and ${playoffGames} playoff games` : ''}`,
      poolGamesCreated: games.length,
      playoffGamesCreated: playoffGames,
      totalGames: games.length + playoffGames,
      rounds: rounds.length,
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
