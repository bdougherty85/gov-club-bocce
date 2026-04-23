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

    // DELETE ALL existing games for this date and season BEFORE creating new ones
    // This includes both pool play (isPlayoff: false) and bracket games (isPlayoff: true)
    const deletedGames = await prisma.game.deleteMany({
      where: {
        seasonId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    console.log(`Deleted ${deletedGames.count} existing games for ${tournamentDate}`);

    // Simple court assignment:
    // - Fill all courts in time slot 1, then all courts in time slot 2, etc.
    // - With 4 courts and 3 time slots: games 1-4 get TS1, games 5-8 get TS2, games 9-12 get TS3
    const numCourts = allCourts.length;
    let gameNumber = 0;

    const getNextCourt = () => {
      // Which time slot? Every N games (where N = numCourts) we move to next time slot
      const timeSlotIndex = Math.floor(gameNumber / numCourts) % timeSlots.length;
      // Which court within that time slot?
      const courtIndex = gameNumber % numCourts;

      const timeSlot = timeSlots[timeSlotIndex];
      const court = allCourts[courtIndex];

      console.log(`Game ${gameNumber}: TimeSlot ${timeSlotIndex} (${timeSlot.startTime}), Court ${courtIndex} (${court.name})`);

      gameNumber++;
      return {
        timeSlotId: timeSlot.id,
        courtId: court.id,
      };
    };

    console.log('Courts:', numCourts, 'Time slots:', timeSlots.length);

    // SINGLE ELIMINATION BRACKET
    if (format === 'single_elimination') {
      const numTeams = allTeams.length;

      // With N teams, we need exactly N-1 games total
      // First round: ALL teams play. If N is even, N/2 games. If N is odd, (N-1)/2 full games + 1 bye
      const numFirstRoundGames = Math.ceil(numTeams / 2);
      const hasBye = numTeams % 2 === 1;

      // Calculate total rounds needed
      // After round 1: ceil(N/2) winners advance
      // Round 2: ceil(ceil(N/2)/2) games, etc.
      let rounds = 1;
      let winnersFromPrevRound = numFirstRoundGames;
      while (winnersFromPrevRound > 1) {
        winnersFromPrevRound = Math.ceil(winnersFromPrevRound / 2);
        rounds++;
      }

      console.log(`Creating bracket: ${numTeams} teams, ${numFirstRoundGames} first-round games, ${rounds} rounds, hasBye: ${hasBye}`);

      // Simple algorithm: traverse teams and fill game slots
      // Game 1: Team 0 vs Team 1
      // Game 2: Team 2 vs Team 3
      // Game N: Team X vs Team X+1 (or bye if odd)
      interface Matchup {
        homeTeamId: string;
        awayTeamId: string | null;
        position: number;
      }

      const firstRoundMatchups: Matchup[] = [];
      let teamIndex = 0;

      for (let gamePos = 0; gamePos < numFirstRoundGames; gamePos++) {
        const homeTeam = allTeams[teamIndex];
        teamIndex++;

        const awayTeam = teamIndex < numTeams ? allTeams[teamIndex] : null;
        if (awayTeam) teamIndex++;

        firstRoundMatchups.push({
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam?.id || null,
          position: gamePos,
        });
      }

      console.log('First round matchups:', firstRoundMatchups.map(m => ({
        home: allTeams.find(t => t.id === m.homeTeamId)?.name,
        away: m.awayTeamId ? allTeams.find(t => t.id === m.awayTeamId)?.name : 'BYE',
      })));

      // Calculate games per round
      const gamesPerRound: number[] = [0]; // index 0 unused
      let g = numFirstRoundGames;
      for (let r = 1; r <= rounds; r++) {
        gamesPerRound.push(g);
        g = Math.ceil(g / 2);
      }
      console.log('Games per round:', gamesPerRound);

      // Create all games
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();
      let totalGames = 0;

      for (let round = 1; round <= rounds; round++) {
        const numGamesThisRound = gamesPerRound[round];
        const roundGames: { id: string; position: number }[] = [];

        for (let position = 0; position < numGamesThisRound; position++) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;

          if (round === 1) {
            // First round - assign teams from matchups
            const matchup = firstRoundMatchups[position];
            if (matchup) {
              homeTeamId = matchup.homeTeamId;
              awayTeamId = matchup.awayTeamId;
            }
          }
          // Later rounds: teams TBD (null) until previous round completes

          // Get court assignment - EVERY game gets a court
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

          console.log(`Created game: round ${round}, pos ${position}, home: ${homeTeamId}, away: ${awayTeamId}, court: ${courtAssignment.courtId}`);

          roundGames.push({ id: game.id, position });
          totalGames++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Link games to next round (winner advances)
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

      // Auto-advance bye games (games where awayTeamId is null)
      const firstRoundGameRefs = gamesByRound.get(1) || [];
      for (const gameRef of firstRoundGameRefs) {
        const game = await prisma.game.findUnique({
          where: { id: gameRef.id },
        });

        if (game && game.homeTeamId && !game.awayTeamId && game.nextGameId) {
          // This is a bye - auto-complete and advance
          await prisma.game.update({
            where: { id: game.id },
            data: { status: 'completed', homeScore: 1, awayScore: 0 },
          });

          const updateField = game.nextGamePosition === 'home' ? 'homeTeamId' : 'awayTeamId';
          await prisma.game.update({
            where: { id: game.nextGameId },
            data: { [updateField]: game.homeTeamId },
          });

          console.log(`Auto-advanced bye: team ${game.homeTeamId} to next game`);
        }
      }

      return NextResponse.json({
        message: `Single elimination bracket created for ${divisionNames}: ${totalGames} games, ${rounds} rounds`,
        totalGames,
        rounds,
        teams: numTeams,
        firstRoundGames: numFirstRoundGames,
        hasBye,
        courtsUsed: allCourts.length,
        deletedOldGames: deletedGames.count,
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

    return NextResponse.json({
      message: `Pool play created for ${divisionNames}: ${createdPoolGames.length} games`,
      poolGamesCreated: createdPoolGames.length,
      totalGames: createdPoolGames.length,
      courtsUsed: allCourts.length,
      deletedOldGames: deletedGames.count,
    });

  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
