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

    // SINGLE ELIMINATION BRACKET
    if (format === 'single_elimination') {
      const numTeams = allTeams.length;

      // Max R1 games = ceil(teams/2) so all teams can start in R1
      const maxR1Games = Math.ceil(numTeams / 2);
      const numFirstRoundGames = firstRoundGames > 0
        ? Math.min(firstRoundGames, maxR1Games)
        : maxR1Games;

      // Teams in R1 = 2 per game, capped at actual team count
      const numTeamsInR1 = Math.min(numFirstRoundGames * 2, numTeams);
      // Teams that skip R1 entirely (go directly to R2)
      const numTeamsWithByes = numTeams - numTeamsInR1;
      // R1 bye games = games where only 1 team (auto-advance)
      const numR1ByeGames = (numFirstRoundGames * 2) - numTeamsInR1;

      // Determine which teams skip R1 (prioritize manually selected for byes)
      const manualByeTeams = allTeams.filter(t => byeTeamIds.includes(t.id));
      const otherTeams = allTeams.filter(t => !byeTeamIds.includes(t.id));

      // Assign R2 byes: manual selections first, then from end of other teams list
      const actualManualByes = Math.min(manualByeTeams.length, numTeamsWithByes);
      const naturalByes = numTeamsWithByes - actualManualByes;

      const teamsSkippingToR2 = [
        ...manualByeTeams.slice(0, actualManualByes),
        ...otherTeams.slice(otherTeams.length - naturalByes),
      ];
      const teamsInRound1 = [
        ...manualByeTeams.slice(actualManualByes),
        ...otherTeams.slice(0, otherTeams.length - naturalByes),
      ];

      // Calculate rounds needed
      // After R1: numFirstRoundGames winners + numTeamsWithByes teams
      let teamsRemaining = numFirstRoundGames + numTeamsWithByes;
      let rounds = 1;
      while (teamsRemaining > 1) {
        teamsRemaining = Math.ceil(teamsRemaining / 2);
        rounds++;
      }

      console.log(`Creating bracket: ${numTeams} teams`);
      console.log(`R1: ${numFirstRoundGames} games, ${numTeamsInR1} teams, ${numR1ByeGames} bye games`);
      console.log(`Skip to R2: ${numTeamsWithByes} (${actualManualByes} manual, ${naturalByes} auto)`);
      console.log(`Teams in R1:`, teamsInRound1.map(t => t.name));
      console.log(`Teams skipping to R2:`, teamsSkippingToR2.map(t => t.name));
      console.log(`Total rounds: ${rounds}`);

      interface Matchup {
        homeTeamId: string;
        awayTeamId: string | null;
        position: number;
      }

      // Create first round matchups
      const firstRoundMatchups: Matchup[] = [];
      let teamIdx = 0;
      for (let gameNum = 0; gameNum < numFirstRoundGames; gameNum++) {
        // Get home team (always exists if we have teams left)
        const homeTeam = teamIdx < teamsInRound1.length ? teamsInRound1[teamIdx] : null;
        if (homeTeam) teamIdx++;

        // Get away team (may be null for bye games)
        const awayTeam = teamIdx < teamsInRound1.length ? teamsInRound1[teamIdx] : null;
        if (awayTeam) teamIdx++;

        // Only create game if we have at least a home team
        if (homeTeam) {
          firstRoundMatchups.push({
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam?.id || null,
            position: gameNum,
          });
        }
      }

      console.log('First round matchups:', firstRoundMatchups.map(m => ({
        pos: m.position,
        home: allTeams.find(t => t.id === m.homeTeamId)?.name,
        away: m.awayTeamId ? allTeams.find(t => t.id === m.awayTeamId)?.name : 'BYE',
      })));

      // Calculate games per round based on teams advancing
      const gamesPerRound: number[] = [0]; // index 0 unused
      gamesPerRound.push(numFirstRoundGames); // Round 1

      let teamsInRound = numFirstRoundGames + numTeamsWithByes; // Teams after R1
      for (let r = 2; r <= rounds; r++) {
        const gamesThisRound = Math.ceil(teamsInRound / 2);
        gamesPerRound.push(gamesThisRound);
        teamsInRound = gamesThisRound; // Winners advance to next round
      }
      console.log('Games per round:', gamesPerRound);

      // Create all games
      const gamesByRound: Map<number, { id: string; position: number }[]> = new Map();
      let totalGames = 0;

      // Round 2 receives R1 winners + bye teams
      // Calculate which R2 positions get bye teams vs R1 winners
      const numR2Games = gamesPerRound[2] || 0;

      // Map R2 game positions to their sources
      // Each R2 game can have: 2 R1 winners, 1 R1 winner + 1 bye, or 2 byes
      interface R2Source {
        homeSource: { type: 'r1' | 'bye'; r1Position?: number; byeTeam?: typeof teamsSkippingToR2[0] };
        awaySource: { type: 'r1' | 'bye'; r1Position?: number; byeTeam?: typeof teamsSkippingToR2[0] };
      }
      const r2Sources: R2Source[] = [];

      let r1PositionCounter = 0;
      let byeTeamIndex = 0;

      for (let r2Pos = 0; r2Pos < numR2Games; r2Pos++) {
        // Each R2 game needs 2 sources (home slot and away slot)
        const sources: R2Source = { homeSource: { type: 'bye' }, awaySource: { type: 'bye' } };

        // Home slot (corresponds to R1 positions 2*r2Pos)
        if (r1PositionCounter < numFirstRoundGames) {
          sources.homeSource = { type: 'r1', r1Position: r1PositionCounter++ };
        } else if (byeTeamIndex < teamsSkippingToR2.length) {
          sources.homeSource = { type: 'bye', byeTeam: teamsSkippingToR2[byeTeamIndex++] };
        }

        // Away slot (corresponds to R1 positions 2*r2Pos + 1)
        if (r1PositionCounter < numFirstRoundGames) {
          sources.awaySource = { type: 'r1', r1Position: r1PositionCounter++ };
        } else if (byeTeamIndex < teamsSkippingToR2.length) {
          sources.awaySource = { type: 'bye', byeTeam: teamsSkippingToR2[byeTeamIndex++] };
        }

        r2Sources.push(sources);
      }

      console.log('R2 sources:', r2Sources.map((s, i) => ({
        r2Pos: i,
        home: s.homeSource.type === 'bye' ? `BYE:${s.homeSource.byeTeam?.name}` : `R1:${s.homeSource.r1Position}`,
        away: s.awaySource.type === 'bye' ? `BYE:${s.awaySource.byeTeam?.name}` : `R1:${s.awaySource.r1Position}`,
      })));

      for (let round = 1; round <= rounds; round++) {
        const numGamesThisRound = gamesPerRound[round];
        const roundGames: { id: string; position: number }[] = [];

        // Start new round - moves to next time slot after previous round
        startNewRound(round, numGamesThisRound);

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
          } else if (round === 2) {
            // Round 2 - place bye teams directly
            const source = r2Sources[position];
            if (source?.homeSource.type === 'bye' && source.homeSource.byeTeam) {
              homeTeamId = source.homeSource.byeTeam.id;
            }
            if (source?.awaySource.type === 'bye' && source.awaySource.byeTeam) {
              awayTeamId = source.awaySource.byeTeam.id;
            }
          }
          // Rounds 3+: teams TBD until previous round completes

          // Get court assignment for this round
          const courtAssignment = getCourtForRound();

          if (!courtAssignment.courtId || !courtAssignment.timeSlotId) {
            console.error(`ERROR: Invalid court assignment for round ${round}, pos ${position}`);
          }

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

          console.log(`R${round} G${position}: home=${homeTeamId ? 'set' : 'TBD'}, away=${awayTeamId ? 'set' : 'TBD'}`);

          roundGames.push({ id: game.id, position });
          totalGames++;
        }

        gamesByRound.set(round, roundGames);
      }

      // Link R1 games to R2 games based on r2Sources
      const r1Games = gamesByRound.get(1) || [];
      const r2Games = gamesByRound.get(2) || [];

      for (let r2Pos = 0; r2Pos < r2Sources.length; r2Pos++) {
        const source = r2Sources[r2Pos];
        const r2Game = r2Games[r2Pos];
        if (!r2Game) continue;

        // Link R1 game to home slot
        if (source.homeSource.type === 'r1' && source.homeSource.r1Position !== undefined) {
          const r1Game = r1Games[source.homeSource.r1Position];
          if (r1Game) {
            await prisma.game.update({
              where: { id: r1Game.id },
              data: { nextGameId: r2Game.id, nextGamePosition: 'home' },
            });
          }
        }

        // Link R1 game to away slot
        if (source.awaySource.type === 'r1' && source.awaySource.r1Position !== undefined) {
          const r1Game = r1Games[source.awaySource.r1Position];
          if (r1Game) {
            await prisma.game.update({
              where: { id: r1Game.id },
              data: { nextGameId: r2Game.id, nextGamePosition: 'away' },
            });
          }
        }
      }

      // Link R2+ games to next rounds (standard bracket linking)
      for (let round = 2; round < rounds; round++) {
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

      return NextResponse.json({
        message: `Single elimination bracket created for ${divisionNames}: ${totalGames} games, ${rounds} rounds`,
        totalGames,
        rounds,
        teams: numTeams,
        firstRoundGames: numFirstRoundGames,
        teamsWithByes: numTeamsWithByes,
        manualByes: actualManualByes,
        naturalByes: naturalByes,
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
