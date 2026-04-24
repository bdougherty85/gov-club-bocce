import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      divisionIds,
      tournamentDate,
      timeSlotIds,
      format = 'single_elimination',
      byeTeamIds = [],
      firstRoundGames = 0, // 0 = auto-calculate
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

    // Get the time slots
    const timeSlots = await prisma.timeSlot.findMany({
      where: { id: { in: timeSlotIds } },
      orderBy: { startTime: 'asc' },
    });

    if (timeSlots.length === 0) {
      return NextResponse.json(
        { error: 'No valid time slots found.' },
        { status: 400 }
      );
    }

    // Get all courts
    const allCourts = await prisma.court.findMany({
      orderBy: { name: 'asc' },
    });

    if (allCourts.length === 0) {
      return NextResponse.json(
        { error: 'No courts configured. Please add courts first.' },
        { status: 400 }
      );
    }

    // Parse the tournament date
    const [year, month, day] = tournamentDate.split('-').map(Number);
    const gameDate = new Date(year, month - 1, day, 12, 0, 0);

    // Create date range for the tournament day (start of day to end of day)
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

    const allTeams = divisions.flatMap((d) => d.teams);
    const seasonId = divisions[0].seasonId;
    const divisionNames = divisions.map((d) => d.name).join(', ');

    if (allTeams.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams for a tournament' },
        { status: 400 }
      );
    }

    // DELETE existing games for this date/season AND all playoff games for this season
    // This ensures we don't have stale bracket games from previous generations
    const [deletedByDate, deletedPlayoffs] = await Promise.all([
      // Delete all games on this date
      prisma.game.deleteMany({
        where: {
          seasonId,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      // Also delete any playoff games for this season (catches stragglers)
      prisma.game.deleteMany({
        where: {
          seasonId,
          isPlayoff: true,
        },
      }),
    ]);
    console.log(`Deleted ${deletedByDate.count} games by date, ${deletedPlayoffs.count} playoff games`);

    // Court assignment per round:
    // - Each round starts at the NEXT time slot after the previous round
    // - Within a round, fill all courts before moving to next time slot
    // - Example: 4 courts, Round 1 has 2 games → uses TS1 (courts 1-2)
    //            Round 2 has 1 game → uses TS2 (court 1), NOT TS1
    const numCourts = allCourts.length;

    // Track court position within each round
    let currentRound = 0;
    let roundStartTimeSlot = 0;
    let gamesInCurrentRound = 0;

    const startNewRound = (round: number, gamesThisRound: number) => {
      // Move to next time slot after previous round
      if (round > 1 && gamesInCurrentRound > 0) {
        const timeSlotsUsedByPrevRound = Math.ceil(gamesInCurrentRound / numCourts);
        roundStartTimeSlot += timeSlotsUsedByPrevRound;
      }
      currentRound = round;
      gamesInCurrentRound = 0;
      console.log(`Round ${round}: starting at time slot ${roundStartTimeSlot}, ${gamesThisRound} games`);
    };

    const getCourtForRound = () => {
      // Time slot = round start + offset based on games in this round
      const timeSlotOffset = Math.floor(gamesInCurrentRound / numCourts);
      const timeSlotIndex = (roundStartTimeSlot + timeSlotOffset) % timeSlots.length;
      // Court cycles within each time slot
      const courtIndex = gamesInCurrentRound % numCourts;

      const timeSlot = timeSlots[timeSlotIndex];
      const court = allCourts[courtIndex];

      console.log(`  Game ${gamesInCurrentRound} in round ${currentRound}: TS${timeSlotIndex} (${timeSlot.startTime}), ${court.name}`);

      gamesInCurrentRound++;
      return {
        timeSlotId: timeSlot.id,
        courtId: court.id,
      };
    };

    console.log('Courts:', numCourts, 'Time slots:', timeSlots.length);

    // SINGLE ELIMINATION BRACKET (Power of 2)
    if (format === 'single_elimination') {
      const numTeams = allTeams.length;

      // R1 games must be power of 2, default to smallest that fits all teams
      const defaultR1Games = Math.pow(2, Math.ceil(Math.log2(Math.ceil(numTeams / 2))));
      const numFirstRoundGames = firstRoundGames > 0 ? firstRoundGames : defaultR1Games;

      // Total slots = R1 games * 2, byes fill the gap
      const totalSlots = numFirstRoundGames * 2;
      const numByes = Math.max(0, totalSlots - numTeams);

      // Separate bye teams from teams that play
      const manualByeTeams = allTeams.filter(t => byeTeamIds.includes(t.id));
      const otherTeams = allTeams.filter(t => !byeTeamIds.includes(t.id));

      // Assign byes: manual first, then from end of list
      const actualManualByes = Math.min(manualByeTeams.length, numByes);
      const autoByes = numByes - actualManualByes;

      const teamsWithByes = [
        ...manualByeTeams.slice(0, actualManualByes),
        ...otherTeams.slice(Math.max(0, otherTeams.length - autoByes)),
      ];
      const teamsWithOpponents = [
        ...manualByeTeams.slice(actualManualByes),
        ...otherTeams.slice(0, Math.max(0, otherTeams.length - autoByes)),
      ];

      // Calculate rounds: log2 of R1 games + 1 (R1, R2, ..., Finals)
      const rounds = Math.log2(numFirstRoundGames) + 1;

      console.log(`Creating bracket: ${numTeams} teams, ${numFirstRoundGames} R1 games (${totalSlots} slots)`);
      console.log(`Byes: ${numByes} (${actualManualByes} manual, ${autoByes} auto)`);
      console.log(`Teams with byes:`, teamsWithByes.map(t => t.name));
      console.log(`Teams with opponents:`, teamsWithOpponents.map(t => t.name));
      console.log(`Rounds: ${rounds}`);

      // Build R1 matchups: pair teams, bye teams get null opponent
      interface Matchup {
        homeTeamId: string;
        awayTeamId: string | null;
        position: number;
      }

      const firstRoundMatchups: Matchup[] = [];

      // Strategy: Place bye teams first (they get TBD opponents), then pair remaining teams
      // Bye teams go in positions 0, 1, 2... so they advance to top of bracket
      for (let i = 0; i < teamsWithByes.length; i++) {
        firstRoundMatchups.push({
          homeTeamId: teamsWithByes[i].id,
          awayTeamId: null, // TBD = bye
          position: i,
        });
      }

      // Remaining slots get paired teams
      let pairIdx = 0;
      for (let pos = teamsWithByes.length; pos < numFirstRoundGames; pos++) {
        const homeTeam = teamsWithOpponents[pairIdx++];
        const awayTeam = teamsWithOpponents[pairIdx++];
        if (homeTeam && awayTeam) {
          firstRoundMatchups.push({
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            position: pos,
          });
        }
      }

      console.log('R1 matchups:', firstRoundMatchups.map(m => ({
        pos: m.position,
        home: allTeams.find(t => t.id === m.homeTeamId)?.name,
        away: m.awayTeamId ? allTeams.find(t => t.id === m.awayTeamId)?.name : 'TBD (bye)',
      })));

      // Games per round: R1 = numFirstRoundGames, then halves each round
      const gamesPerRound: number[] = [0]; // index 0 unused
      let gamesInRound = numFirstRoundGames;
      for (let r = 1; r <= rounds; r++) {
        gamesPerRound.push(gamesInRound);
        gamesInRound = Math.floor(gamesInRound / 2);
      }
      console.log('Games per round:', gamesPerRound);

      // Create all games
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();
      let totalGames = 0;

      for (let round = 1; round <= rounds; round++) {
        const numGamesThisRound = gamesPerRound[round];
        const roundGames: { id: string; position: number }[] = [];

        startNewRound(round, numGamesThisRound);

        for (let position = 0; position < numGamesThisRound; position++) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;
          let isByeGame = false;

          if (round === 1) {
            const matchup = firstRoundMatchups.find(m => m.position === position);
            if (matchup) {
              homeTeamId = matchup.homeTeamId;
              awayTeamId = matchup.awayTeamId;
              isByeGame = awayTeamId === null; // Bye = no opponent
            }
          }
          // Later rounds: TBD until previous round completes

          // Only assign court/time for real matches (not byes)
          let timeSlotId: string | null = null;
          let courtId: string | null = null;
          if (!isByeGame) {
            const courtAssignment = getCourtForRound();
            timeSlotId = courtAssignment.timeSlotId;
            courtId = courtAssignment.courtId;
          }

          const game = await prisma.game.create({
            data: {
              seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: gameDate,
              timeSlotId,
              courtId,
              isPlayoff: true,
              playoffRound: round,
              playoffPosition: position,
              status: isByeGame ? 'completed' : 'scheduled', // Bye games auto-complete
              homeScore: isByeGame ? 1 : null, // Bye team wins by default
              awayScore: isByeGame ? 0 : null,
            },
          });

          roundGames.push({ id: game.id, position });
          totalGames++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Link games: standard bracket linking (positions 0,1 -> next round pos 0; 2,3 -> pos 1; etc.)
      for (let round = 1; round < rounds; round++) {
        const currentRoundGames = gamesByRound.get(round) || [];
        const nextRoundGames = gamesByRound.get(round + 1) || [];

        for (const game of currentRoundGames) {
          const nextGameIndex = Math.floor(game.position / 2);
          const nextGame = nextRoundGames[nextGameIndex];
          const nextGamePosition = game.position % 2 === 0 ? 'home' : 'away';

          if (nextGame) {
            await prisma.game.update({
              where: { id: game.id },
              data: { nextGameId: nextGame.id, nextGamePosition },
            });
          }
        }
      }

      // Auto-advance bye game winners to Round 2
      const r1Games = gamesByRound.get(1) || [];
      for (const gameRef of r1Games) {
        const game = await prisma.game.findUnique({
          where: { id: gameRef.id },
        });

        // If bye game (completed with home team, no away team), advance winner
        if (game && game.status === 'completed' && game.homeTeamId && !game.awayTeamId && game.nextGameId) {
          const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
          await prisma.game.update({
            where: { id: game.nextGameId },
            data: { [updateField]: game.homeTeamId },
          });
          console.log(`Bye winner ${game.homeTeamId} advanced to R2`);
        }
      }

      return NextResponse.json({
        message: `Single elimination bracket created for ${divisionNames}: ${totalGames} games, ${rounds} rounds`,
        totalGames,
        rounds,
        teams: numTeams,
        firstRoundGames: numFirstRoundGames,
        totalSlots,
        byes: numByes,
        courtsUsed: allCourts.length,
        deletedOldGames: deletedByDate.count + deletedPlayoffs.count,
      });
    }

    // POOL PLAY + PLAYOFFS FORMAT (round-robin then bracket)
    const allTeamIds = allTeams.map(t => t.id);
    const poolGames: { homeId: string; awayId: string }[] = [];

    // Round-robin: every team plays every other team once
    for (let i = 0; i < allTeamIds.length; i++) {
      for (let j = i + 1; j < allTeamIds.length; j++) {
        poolGames.push({
          homeId: allTeamIds[i],
          awayId: allTeamIds[j],
        });
      }
    }

    // Simple court assignment for pool play: fill courts, then next time slot
    let poolGameIndex = 0;
    const getPoolCourt = () => {
      const timeSlotIndex = Math.floor(poolGameIndex / numCourts) % timeSlots.length;
      const courtIndex = poolGameIndex % numCourts;
      poolGameIndex++;
      return {
        timeSlotId: timeSlots[timeSlotIndex].id,
        courtId: allCourts[courtIndex].id,
      };
    };

    // Create pool play games
    const createdPoolGames = [];
    for (const pg of poolGames) {
      const courtAssignment = getPoolCourt();

      const game = await prisma.game.create({
        data: {
          seasonId,
          homeTeamId: pg.homeId,
          awayTeamId: pg.awayId,
          scheduledDate: gameDate,
          timeSlotId: courtAssignment.timeSlotId,
          courtId: courtAssignment.courtId,
          isPlayoff: false,
          status: 'scheduled',
        },
      });
      createdPoolGames.push(game);
    }

    return NextResponse.json({
      message: `Pool play created for ${divisionNames}: ${createdPoolGames.length} games`,
      poolGamesCreated: createdPoolGames.length,
      totalGames: createdPoolGames.length,
      courtsUsed: allCourts.length,
      deletedOldGames: deletedByDate.count + deletedPlayoffs.count,
    });

  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
