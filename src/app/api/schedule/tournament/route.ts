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
      teamsInPlayoffs = 4,
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

    const allTeams = divisions.flatMap((d) => d.teams);
    const seasonId = divisions[0].seasonId;
    const divisionNames = divisions.map((d) => d.name).join(', ');

    if (allTeams.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams for a tournament' },
        { status: 400 }
      );
    }

    // Build court assignments: cycle through time slots, and for each time slot all courts are available
    // courtAssignments[i] = { timeSlotId, courtId }
    const courtAssignments: { timeSlotId: string; courtId: string }[] = [];
    for (const timeSlot of timeSlots) {
      for (const court of allCourts) {
        courtAssignments.push({
          timeSlotId: timeSlot.id,
          courtId: court.id,
        });
      }
    }

    console.log('Court assignments created:', courtAssignments.length, 'slots');
    console.log('Sample:', courtAssignments[0]);

    let courtIndex = 0;
    const getNextCourt = () => {
      const assignment = courtAssignments[courtIndex % courtAssignments.length];
      courtIndex++;
      return assignment;
    };

    // SINGLE ELIMINATION BRACKET
    if (format === 'single_elimination') {
      const numTeams = allTeams.length;

      // First round: pair all teams. If odd, one bye.
      // N teams -> ceil(N/2) first round games
      // If N is even: N/2 games, all full
      // If N is odd: (N-1)/2 full games + 1 bye = ceil(N/2) games

      const firstRoundGames = Math.ceil(numTeams / 2);
      const hasbye = numTeams % 2 === 1;

      // Calculate total rounds
      let rounds = 1;
      let gamesInRound = firstRoundGames;
      while (gamesInRound > 1) {
        gamesInRound = Math.ceil(gamesInRound / 2);
        rounds++;
      }

      console.log(`Creating bracket: ${numTeams} teams, ${firstRoundGames} first-round games, ${rounds} rounds, bye: ${hasbye}`);

      // Create first-round matchups with seeding: 1vN, 2v(N-1), etc.
      // This maximizes competitive balance
      interface FirstRoundGame {
        homeTeamId: string;
        awayTeamId: string | null;
        position: number;
      }

      const firstRoundMatchups: FirstRoundGame[] = [];

      // For N teams, we pair:
      // - Team 0 vs Team N-1
      // - Team 1 vs Team N-2
      // - ...
      // - If odd, middle team (index floor(N/2)) gets bye

      if (numTeams % 2 === 0) {
        // Even number - all games have two teams
        for (let i = 0; i < numTeams / 2; i++) {
          firstRoundMatchups.push({
            homeTeamId: allTeams[i].id,
            awayTeamId: allTeams[numTeams - 1 - i].id,
            position: i,
          });
        }
      } else {
        // Odd number - last game is a bye for middle team
        const fullGames = Math.floor(numTeams / 2);
        for (let i = 0; i < fullGames; i++) {
          firstRoundMatchups.push({
            homeTeamId: allTeams[i].id,
            awayTeamId: allTeams[numTeams - 1 - i].id,
            position: i,
          });
        }
        // Bye for the middle team
        const byeTeamIndex = Math.floor(numTeams / 2);
        firstRoundMatchups.push({
          homeTeamId: allTeams[byeTeamIndex].id,
          awayTeamId: null,
          position: fullGames,
        });
      }

      console.log('First round matchups:', firstRoundMatchups.length);
      console.log('Full games:', firstRoundMatchups.filter(m => m.awayTeamId !== null).length);
      console.log('Bye games:', firstRoundMatchups.filter(m => m.awayTeamId === null).length);

      // Now create all bracket games
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();
      let totalGames = 0;

      // Calculate games per round
      const gamesPerRound: number[] = [0]; // index 0 unused
      let g = firstRoundGames;
      for (let r = 1; r <= rounds; r++) {
        gamesPerRound.push(g);
        g = Math.ceil(g / 2);
      }

      // Create games round by round
      for (let round = 1; round <= rounds; round++) {
        const numGamesThisRound = gamesPerRound[round];
        const roundGames: { id: string; position: number }[] = [];

        for (let position = 0; position < numGamesThisRound; position++) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;

          if (round === 1) {
            // First round - use our matchups
            const matchup = firstRoundMatchups[position];
            homeTeamId = matchup.homeTeamId;
            awayTeamId = matchup.awayTeamId;
          }
          // Later rounds: teams TBD until previous round completes

          // Get court assignment
          const courtAssignment = getNextCourt();

          const game = await prisma.game.create({
            data: {
              seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: gameDate,
              timeSlotId: courtAssignment.timeSlotId,
              courtId: courtAssignment.courtId,
              isPlayoff: true,
              playoffRound: round,
              playoffPosition: position,
              status: 'scheduled',
            },
          });

          console.log(`Created game ${game.id}: round ${round}, pos ${position}, court ${courtAssignment.courtId}`);

          roundGames.push({ id: game.id, position });
          totalGames++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Link games to next round
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
              data: {
                nextGameId: nextGame.id,
                nextGamePosition,
              },
            });
          }
        }
      }

      // Auto-advance bye games
      const firstRoundGameRefs = gamesByRound.get(1) || [];
      for (const gameRef of firstRoundGameRefs) {
        const game = await prisma.game.findUnique({
          where: { id: gameRef.id },
        });

        if (game && game.nextGameId && game.homeTeamId && !game.awayTeamId) {
          // This is a bye - auto-advance
          await prisma.game.update({
            where: { id: game.id },
            data: { status: 'completed', homeScore: 1, awayScore: 0 },
          });

          const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
          await prisma.game.update({
            where: { id: game.nextGameId },
            data: { [updateField]: game.homeTeamId },
          });

          console.log(`Auto-advanced bye: team ${game.homeTeamId} to game ${game.nextGameId}`);
        }
      }

      return NextResponse.json({
        message: `Single elimination bracket created for ${divisionNames}: ${totalGames} games, ${rounds} rounds`,
        totalGames,
        rounds,
        teams: numTeams,
        firstRoundGames,
        hasBye: hasbye,
        courtsUsed: allCourts.length,
      });
    }

    // POOL PLAY + PLAYOFFS FORMAT
    // Generate round-robin pool play, then playoff bracket

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

    // Create pool play games
    const createdPoolGames = [];
    for (const pg of poolGames) {
      const courtAssignment = getNextCourt();

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

    // Create playoff bracket if requested
    let playoffGamesCreated = 0;
    if (teamsInPlayoffs >= 2 && allTeams.length >= 2) {
      const numPlayoffTeams = Math.min(teamsInPlayoffs, allTeams.length);
      const playoffTeams = allTeams.slice(0, numPlayoffTeams);

      const firstRoundGames = Math.ceil(numPlayoffTeams / 2);
      const hasBye = numPlayoffTeams % 2 === 1;

      let rounds = 1;
      let g = firstRoundGames;
      while (g > 1) {
        g = Math.ceil(g / 2);
        rounds++;
      }

      // Create first-round matchups
      const firstRoundMatchups: { homeTeamId: string; awayTeamId: string | null; position: number }[] = [];

      if (numPlayoffTeams % 2 === 0) {
        for (let i = 0; i < numPlayoffTeams / 2; i++) {
          firstRoundMatchups.push({
            homeTeamId: playoffTeams[i].id,
            awayTeamId: playoffTeams[numPlayoffTeams - 1 - i].id,
            position: i,
          });
        }
      } else {
        const fullGames = Math.floor(numPlayoffTeams / 2);
        for (let i = 0; i < fullGames; i++) {
          firstRoundMatchups.push({
            homeTeamId: playoffTeams[i].id,
            awayTeamId: playoffTeams[numPlayoffTeams - 1 - i].id,
            position: i,
          });
        }
        const byeTeamIndex = Math.floor(numPlayoffTeams / 2);
        firstRoundMatchups.push({
          homeTeamId: playoffTeams[byeTeamIndex].id,
          awayTeamId: null,
          position: fullGames,
        });
      }

      const gamesPerRound: number[] = [0];
      g = firstRoundGames;
      for (let r = 1; r <= rounds; r++) {
        gamesPerRound.push(g);
        g = Math.ceil(g / 2);
      }

      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();

      for (let round = 1; round <= rounds; round++) {
        const numGamesThisRound = gamesPerRound[round];
        const roundGames: { id: string; position: number }[] = [];

        for (let position = 0; position < numGamesThisRound; position++) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;

          if (round === 1) {
            const matchup = firstRoundMatchups[position];
            homeTeamId = matchup.homeTeamId;
            awayTeamId = matchup.awayTeamId;
          }

          const courtAssignment = getNextCourt();

          const game = await prisma.game.create({
            data: {
              seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: gameDate,
              timeSlotId: courtAssignment.timeSlotId,
              courtId: courtAssignment.courtId,
              isPlayoff: true,
              playoffRound: round,
              playoffPosition: position,
              status: 'scheduled',
            },
          });

          roundGames.push({ id: game.id, position });
          playoffGamesCreated++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Link playoff games
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
              data: {
                nextGameId: nextGame.id,
                nextGamePosition,
              },
            });
          }
        }
      }

      // Auto-advance byes
      const firstRoundGameRefs = gamesByRound.get(1) || [];
      for (const gameRef of firstRoundGameRefs) {
        const game = await prisma.game.findUnique({ where: { id: gameRef.id } });
        if (game && game.nextGameId && game.homeTeamId && !game.awayTeamId) {
          await prisma.game.update({
            where: { id: game.id },
            data: { status: 'completed', homeScore: 1, awayScore: 0 },
          });
          const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
          await prisma.game.update({
            where: { id: game.nextGameId },
            data: { [updateField]: game.homeTeamId },
          });
        }
      }
    }

    return NextResponse.json({
      message: `Tournament created for ${divisionNames}: ${createdPoolGames.length} pool games, ${playoffGamesCreated} playoff games`,
      poolGamesCreated: createdPoolGames.length,
      playoffGamesCreated,
      totalGames: createdPoolGames.length + playoffGamesCreated,
      courtsUsed: allCourts.length,
    });

  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
