import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface TeamScheduleState {
  id: string;
  lastPlayedSlotIndex: number; // -1 means hasn't played yet
  gamesPlayed: number;
}

interface CourtSlot {
  timeSlotId: string;
  courtId: string;
  courtName: string;
  startTime: string;
  slotIndex: number; // Global ordering index
}

// Group time slots by start time and create court slots
function createCourtSlots(
  timeSlots: { id: string; startTime: string; courtId: string | null; court: { id: string; name: string } | null }[]
): CourtSlot[] {
  const slots: CourtSlot[] = [];

  // Sort by start time
  const sorted = [...timeSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Group by start time
  const byTime = new Map<string, typeof sorted>();
  for (const slot of sorted) {
    const time = slot.startTime;
    if (!byTime.has(time)) {
      byTime.set(time, []);
    }
    byTime.get(time)!.push(slot);
  }

  // Create court slots with global index
  let slotIndex = 0;
  for (const [startTime, timeSlotGroup] of Array.from(byTime.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const ts of timeSlotGroup) {
      if (ts.courtId && ts.court) {
        slots.push({
          timeSlotId: ts.id,
          courtId: ts.courtId,
          courtName: ts.court.name,
          startTime,
          slotIndex,
        });
      }
    }
    // All courts at same time share the same slot index (they run concurrently)
    slotIndex++;
  }

  return slots;
}

// Get available courts for a given slot index
function getCourtsAtSlotIndex(courtSlots: CourtSlot[], slotIndex: number): CourtSlot[] {
  return courtSlots.filter(cs => cs.slotIndex === slotIndex);
}

// Get the maximum slot index
function getMaxSlotIndex(courtSlots: CourtSlot[]): number {
  return Math.max(...courtSlots.map(cs => cs.slotIndex), -1);
}

// Round-robin scheduling with fair team rotation
function generateFairRoundRobin(
  teams: string[],
  courtSlots: CourtSlot[]
): { home: string; away: string; courtSlot: CourtSlot }[] {
  const n = teams.length;
  if (n < 2) return [];

  // Generate all matchups using round-robin algorithm
  const allMatchups: [string, string][] = [];
  const teamList = n % 2 === 0 ? [...teams] : [...teams, 'BYE'];
  const numTeams = teamList.length;
  const numRounds = numTeams - 1;
  const halfSize = numTeams / 2;
  const teamIndices = teamList.map((_, i) => i);

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < halfSize; i++) {
      const home = teamIndices[i];
      const away = teamIndices[numTeams - 1 - i];

      if (teamList[home] !== 'BYE' && teamList[away] !== 'BYE') {
        if (round % 2 === 0) {
          allMatchups.push([teamList[home], teamList[away]]);
        } else {
          allMatchups.push([teamList[away], teamList[home]]);
        }
      }
    }
    const last = teamIndices.pop()!;
    teamIndices.splice(1, 0, last);
  }

  // Now schedule games fairly - teams that haven't played recently go first
  const teamState: Map<string, TeamScheduleState> = new Map();
  for (const teamId of teams) {
    teamState.set(teamId, { id: teamId, lastPlayedSlotIndex: -1, gamesPlayed: 0 });
  }

  const scheduledGames: { home: string; away: string; courtSlot: CourtSlot }[] = [];
  const remainingMatchups = [...allMatchups];
  const maxSlotIndex = getMaxSlotIndex(courtSlots);

  let currentSlotIndex = 0;

  while (remainingMatchups.length > 0 && currentSlotIndex <= maxSlotIndex * 2) {
    const courtsAtSlot = getCourtsAtSlotIndex(courtSlots, currentSlotIndex % (maxSlotIndex + 1));

    if (courtsAtSlot.length === 0) {
      currentSlotIndex++;
      continue;
    }

    // Find games where both teams haven't played this slot
    // Prioritize teams that have waited longest
    const eligibleGames = remainingMatchups
      .map((matchup, index) => {
        const [home, away] = matchup;
        const homeState = teamState.get(home)!;
        const awayState = teamState.get(away)!;

        // Can't play if either team played in the previous slot
        const homeCanPlay = homeState.lastPlayedSlotIndex < currentSlotIndex;
        const awayCanPlay = awayState.lastPlayedSlotIndex < currentSlotIndex;

        if (!homeCanPlay || !awayCanPlay) return null;

        // Priority: sum of wait time (higher = waited longer)
        const homeWait = currentSlotIndex - homeState.lastPlayedSlotIndex;
        const awayWait = currentSlotIndex - awayState.lastPlayedSlotIndex;
        const priority = homeWait + awayWait;

        return { matchup, index, priority };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.priority - a.priority); // Highest priority first

    // Schedule as many games as we have courts
    const gamesToSchedule = eligibleGames.slice(0, courtsAtSlot.length);

    if (gamesToSchedule.length === 0) {
      // No eligible games for this slot, move to next
      currentSlotIndex++;
      continue;
    }

    // Schedule the games
    for (let i = 0; i < gamesToSchedule.length; i++) {
      const game = gamesToSchedule[i];
      const courtSlot = courtsAtSlot[i];
      const [home, away] = game.matchup;

      scheduledGames.push({ home, away, courtSlot });

      // Update team state
      teamState.get(home)!.lastPlayedSlotIndex = currentSlotIndex;
      teamState.get(home)!.gamesPlayed++;
      teamState.get(away)!.lastPlayedSlotIndex = currentSlotIndex;
      teamState.get(away)!.gamesPlayed++;

      // Remove from remaining
      const idx = remainingMatchups.indexOf(game.matchup);
      if (idx > -1) remainingMatchups.splice(idx, 1);
    }

    currentSlotIndex++;
  }

  // If we still have remaining matchups, we need more time slots
  // Cycle through available court slots
  if (remainingMatchups.length > 0) {
    let courtIdx = 0;
    for (const matchup of remainingMatchups) {
      const [home, away] = matchup;
      const courtSlot = courtSlots[courtIdx % courtSlots.length];
      scheduledGames.push({ home, away, courtSlot });
      courtIdx++;
    }
  }

  return scheduledGames;
}

// Calculate bracket structure for N teams
// Returns: { firstRoundGames, byes, totalRounds }
function calculateBracketStructure(numTeams: number): {
  firstRoundGames: number;
  byes: number;
  totalRounds: number;
  bracketSize: number;
} {
  if (numTeams < 2) {
    return { firstRoundGames: 0, byes: 0, totalRounds: 0, bracketSize: 0 };
  }

  const totalRounds = Math.ceil(Math.log2(numTeams));
  const bracketSize = Math.pow(2, totalRounds);
  const byes = bracketSize - numTeams;
  const firstRoundGames = (numTeams - byes) / 2; // Teams that play in first round

  // Actually: first round games = bracketSize/2 - byes that skip first round
  // If 8 teams, bracketSize=8, byes=0, firstRoundGames = 4
  // If 7 teams, bracketSize=8, byes=1, firstRoundGames = 3 (6 teams play, 1 bye to round 2)
  // If 6 teams, bracketSize=8, byes=2, firstRoundGames = 2 (4 teams play, 2 bye to round 2)
  // If 5 teams, bracketSize=8, byes=3, firstRoundGames = 1 (2 teams play, 3 bye to round 2)

  // Formula: firstRoundGames = numTeams - bracketSize/2
  const actualFirstRoundGames = numTeams - bracketSize / 2;

  return {
    firstRoundGames: Math.max(0, actualFirstRoundGames),
    byes,
    totalRounds,
    bracketSize,
  };
}

// Generate seeding for first round - top seeds get byes
function generateFirstRoundMatchups(
  teams: { id: string; seed: number }[],
  structure: ReturnType<typeof calculateBracketStructure>
): { homeTeamId: string | null; awayTeamId: string | null; position: number }[] {
  const { firstRoundGames, byes, bracketSize } = structure;

  if (teams.length < 2) return [];

  const matchups: { homeTeamId: string | null; awayTeamId: string | null; position: number }[] = [];
  const halfBracket = bracketSize / 2;

  // Top seeds (1 through byes) get byes
  // Remaining teams play in first round

  // Standard bracket seeding for first round:
  // Position 0: Seed 1 vs Seed 8 (if no byes) or Seed 1 bye
  // Position 1: Seed 4 vs Seed 5
  // Position 2: Seed 3 vs Seed 6
  // Position 3: Seed 2 vs Seed 7

  // For 8 team bracket positions: 1v8, 4v5, 3v6, 2v7
  const standardSeeding8 = [
    [0, 7], // 1 vs 8
    [3, 4], // 4 vs 5
    [2, 5], // 3 vs 6
    [1, 6], // 2 vs 7
  ];

  // For 4 team bracket: 1v4, 2v3
  const standardSeeding4 = [
    [0, 3], // 1 vs 4
    [1, 2], // 2 vs 3
  ];

  // For 2 team bracket: 1v2
  const standardSeeding2 = [
    [0, 1], // 1 vs 2
  ];

  // Use appropriate seeding based on bracket size
  let seedPattern: number[][];
  if (halfBracket === 4) {
    seedPattern = standardSeeding8;
  } else if (halfBracket === 2) {
    seedPattern = standardSeeding4;
  } else if (halfBracket === 1) {
    seedPattern = standardSeeding2;
  } else {
    // Generate pattern for larger brackets
    seedPattern = [];
    for (let i = 0; i < halfBracket; i++) {
      seedPattern.push([i, bracketSize - 1 - i]);
    }
  }

  for (let position = 0; position < halfBracket; position++) {
    const [homeSeed, awaySeed] = seedPattern[position] || [position, bracketSize - 1 - position];

    const homeTeam = teams.find(t => t.seed === homeSeed);
    const awayTeam = teams.find(t => t.seed === awaySeed);

    // Only create a game if at least one team exists (not a double-bye)
    if (homeTeam || awayTeam) {
      matchups.push({
        homeTeamId: homeTeam?.id || null,
        awayTeamId: awayTeam?.id || null,
        position,
      });
    }
  }

  return matchups;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      divisionIds,
      tournamentDate,
      timeSlotIds,
      format = 'pool_and_playoffs',
      teamsInPlayoffs = 4,
      includePlayoffs = true,
    } = body;

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

    // Get the time slots with courts
    const timeSlots = await prisma.timeSlot.findMany({
      where: { id: { in: timeSlotIds } },
      include: { court: true },
      orderBy: { startTime: 'asc' },
    });

    // Filter to only time slots that have courts assigned
    const timeSlotsWithCourts = timeSlots.filter(ts => ts.courtId && ts.court);

    if (timeSlotsWithCourts.length === 0) {
      return NextResponse.json(
        { error: 'No time slots with courts assigned. Each time slot must have a court.' },
        { status: 400 }
      );
    }

    // Create court slots structure
    const courtSlots = createCourtSlots(timeSlotsWithCourts);

    if (courtSlots.length === 0) {
      return NextResponse.json(
        { error: 'No courts available. Please assign courts to time slots.' },
        { status: 400 }
      );
    }

    // Parse the tournament date
    const [year, month, day] = tournamentDate.split('-').map(Number);
    const gameDate = new Date(year, month - 1, day, 12, 0, 0);

    const allTeams = divisions.flatMap((d) => d.teams);
    const seasonId = divisions[0].seasonId;
    const divisionNames = divisions.map((d) => d.name).join(', ');

    // Calculate total courts available per time block
    const courtsPerTimeBlock = new Map<string, number>();
    for (const slot of courtSlots) {
      courtsPerTimeBlock.set(slot.startTime, (courtsPerTimeBlock.get(slot.startTime) || 0) + 1);
    }

    // SINGLE ELIMINATION FORMAT
    if (format === 'single_elimination') {
      if (allTeams.length < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 teams for single elimination' },
          { status: 400 }
        );
      }

      const numTeams = allTeams.length;
      const structure = calculateBracketStructure(numTeams);

      // Seed teams (for now, use order they appear - could be based on standings later)
      const seededTeams = allTeams.map((team, idx) => ({
        id: team.id,
        seed: idx,
      }));

      const firstRoundMatchups = generateFirstRoundMatchups(seededTeams, structure);
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();

      let courtSlotIdx = 0;
      let totalGames = 0;

      // Create games from first round forward
      // Round 1 is first round, highest round is finals
      for (let round = 1; round <= structure.totalRounds; round++) {
        const gamesInRound = Math.pow(2, structure.totalRounds - round);
        const roundGames: { id: string; position: number }[] = [];

        for (let position = 0; position < gamesInRound; position++) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;

          if (round === 1) {
            // First round - use generated matchups
            const matchup = firstRoundMatchups.find(m => m.position === position);
            if (matchup) {
              homeTeamId = matchup.homeTeamId;
              awayTeamId = matchup.awayTeamId;
            }
          }
          // Later rounds start with TBD teams (filled when previous round completes)

          // Get court for this game (cycle through available courts)
          const courtSlot = courtSlots[courtSlotIdx % courtSlots.length];
          courtSlotIdx++;

          const game = await prisma.game.create({
            data: {
              seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: gameDate,
              timeSlotId: courtSlot.timeSlotId,
              courtId: courtSlot.courtId,
              isPlayoff: true,
              playoffRound: round,
              playoffPosition: position,
              nextGameId: null, // Will update after all games created
              nextGamePosition: null,
              status: 'scheduled',
            },
          });

          roundGames.push({ id: game.id, position });
          totalGames++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Now update nextGameId references
      for (let round = 1; round < structure.totalRounds; round++) {
        const currentRoundGames = gamesByRound.get(round) || [];
        const nextRoundGames = gamesByRound.get(round + 1) || [];

        for (const game of currentRoundGames) {
          const nextGameIndex = Math.floor(game.position / 2);
          const nextGame = nextRoundGames[nextGameIndex];
          const nextGamePosition = game.position % 2 === 0 ? 'home' : 'away';

          if (nextGame) {
            await prisma.game.update({
              where: { id: game.id },
              data: {
                nextGameId: nextGame.id,
                nextGamePosition,
              },
            });
          }
        }
      }

      // Handle byes - if a first round game has only one team, auto-advance them
      const firstRoundGames = gamesByRound.get(1) || [];
      for (const gameRef of firstRoundGames) {
        const game = await prisma.game.findUnique({
          where: { id: gameRef.id },
          include: { homeTeam: true, awayTeam: true },
        });

        if (game && game.nextGameId) {
          // If only home team exists (away is bye)
          if (game.homeTeamId && !game.awayTeamId) {
            await prisma.game.update({
              where: { id: game.id },
              data: { status: 'completed', homeScore: 1, awayScore: 0 },
            });
            // Advance home team to next game
            const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
            await prisma.game.update({
              where: { id: game.nextGameId },
              data: { [updateField]: game.homeTeamId },
            });
          }
          // If only away team exists (home is bye)
          else if (!game.homeTeamId && game.awayTeamId) {
            await prisma.game.update({
              where: { id: game.id },
              data: { status: 'completed', homeScore: 0, awayScore: 1 },
            });
            // Advance away team to next game
            const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
            await prisma.game.update({
              where: { id: game.nextGameId },
              data: { [updateField]: game.awayTeamId },
            });
          }
        }
      }

      return NextResponse.json({
        message: `Single elimination tournament created for ${divisionNames}: ${totalGames} bracket games, ${structure.totalRounds} rounds`,
        bracketGamesCreated: totalGames,
        totalGames,
        rounds: structure.totalRounds,
        teams: numTeams,
        byes: structure.byes,
        divisions: divisions.length,
      });
    }

    // POOL PLAY + PLAYOFFS FORMAT
    const allTeamIds = allTeams.map(t => t.id);
    const scheduledPoolGames = generateFairRoundRobin(allTeamIds, courtSlots);

    if (scheduledPoolGames.length === 0) {
      return NextResponse.json(
        { error: 'No games to schedule (need at least 2 teams)' },
        { status: 400 }
      );
    }

    const games = [];

    // Create pool play games
    for (const poolGame of scheduledPoolGames) {
      const createdGame = await prisma.game.create({
        data: {
          seasonId,
          homeTeamId: poolGame.home,
          awayTeamId: poolGame.away,
          scheduledDate: gameDate,
          timeSlotId: poolGame.courtSlot.timeSlotId,
          courtId: poolGame.courtSlot.courtId,
          weekNumber: 1,
          isPlayoff: false,
          status: 'scheduled',
        },
      });
      games.push(createdGame);
    }

    let playoffGames = 0;

    // Generate playoff bracket if requested
    if (includePlayoffs && teamsInPlayoffs >= 2 && allTeams.length >= 2) {
      const numTeamsForPlayoffs = Math.min(teamsInPlayoffs, allTeams.length);
      const structure = calculateBracketStructure(numTeamsForPlayoffs);

      // Seed teams (order determines seeding - could be based on pool standings later)
      const seededTeams = allTeams.slice(0, numTeamsForPlayoffs).map((team, idx) => ({
        id: team.id,
        seed: idx,
      }));

      const firstRoundMatchups = generateFirstRoundMatchups(seededTeams, structure);
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();

      // Start playoff court slots after pool play
      let courtSlotIdx = scheduledPoolGames.length;

      for (let round = 1; round <= structure.totalRounds; round++) {
        const gamesInRound = Math.pow(2, structure.totalRounds - round);
        const roundGames: { id: string; position: number }[] = [];

        for (let position = 0; position < gamesInRound; position++) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;

          if (round === 1) {
            const matchup = firstRoundMatchups.find(m => m.position === position);
            if (matchup) {
              homeTeamId = matchup.homeTeamId;
              awayTeamId = matchup.awayTeamId;
            }
          }

          const courtSlot = courtSlots[courtSlotIdx % courtSlots.length];
          courtSlotIdx++;

          const game = await prisma.game.create({
            data: {
              seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: gameDate,
              timeSlotId: courtSlot.timeSlotId,
              courtId: courtSlot.courtId,
              isPlayoff: true,
              playoffRound: round,
              playoffPosition: position,
              status: 'scheduled',
            },
          });

          roundGames.push({ id: game.id, position });
          playoffGames++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Update nextGameId references
      for (let round = 1; round < structure.totalRounds; round++) {
        const currentRoundGames = gamesByRound.get(round) || [];
        const nextRoundGames = gamesByRound.get(round + 1) || [];

        for (const game of currentRoundGames) {
          const nextGameIndex = Math.floor(game.position / 2);
          const nextGame = nextRoundGames[nextGameIndex];
          const nextGamePosition = game.position % 2 === 0 ? 'home' : 'away';

          if (nextGame) {
            await prisma.game.update({
              where: { id: game.id },
              data: {
                nextGameId: nextGame.id,
                nextGamePosition,
              },
            });
          }
        }
      }

      // Handle byes for first round
      const firstRoundGames = gamesByRound.get(1) || [];
      for (const gameRef of firstRoundGames) {
        const game = await prisma.game.findUnique({
          where: { id: gameRef.id },
          include: { homeTeam: true, awayTeam: true },
        });

        if (game && game.nextGameId) {
          if (game.homeTeamId && !game.awayTeamId) {
            await prisma.game.update({
              where: { id: game.id },
              data: { status: 'completed', homeScore: 1, awayScore: 0 },
            });
            const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
            await prisma.game.update({
              where: { id: game.nextGameId },
              data: { [updateField]: game.homeTeamId },
            });
          } else if (!game.homeTeamId && game.awayTeamId) {
            await prisma.game.update({
              where: { id: game.id },
              data: { status: 'completed', homeScore: 0, awayScore: 1 },
            });
            const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
            await prisma.game.update({
              where: { id: game.nextGameId },
              data: { [updateField]: game.awayTeamId },
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: `Tournament created for ${divisionNames}: ${games.length} pool play games${playoffGames > 0 ? ` and ${playoffGames} playoff games` : ''}`,
      poolGamesCreated: games.length,
      playoffGamesCreated: playoffGames,
      totalGames: games.length + playoffGames,
      divisions: divisions.length,
      courtsUsed: courtSlots.length,
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
