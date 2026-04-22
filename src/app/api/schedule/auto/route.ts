import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Round-robin scheduling algorithm
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
        // Alternate home/away
        if (round % 2 === 0) {
          roundMatches.push([teamList[home], teamList[away]]);
        } else {
          roundMatches.push([teamList[away], teamList[home]]);
        }
      }
    }

    rounds.push(roundMatches);

    // Rotate teams (keep first team fixed)
    const last = teamIndices.pop()!;
    teamIndices.splice(1, 0, last);
  }

  return rounds;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { divisionId, startDate, doubleRoundRobin = false } = body;

    if (!divisionId || !startDate) {
      return NextResponse.json(
        { error: 'Division ID and start date are required' },
        { status: 400 }
      );
    }

    // Get the division with its teams and play nights
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        teams: true,
        playNights: {
          include: {
            timeSlot: true,
          },
        },
        season: true,
      },
    });

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }

    if (division.teams.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams to create a schedule' },
        { status: 400 }
      );
    }

    const teamIds = division.teams.map((t) => t.id);
    let rounds = generateRoundRobin(teamIds);

    // For double round robin, duplicate and swap home/away
    if (doubleRoundRobin) {
      const secondHalf = rounds.map(round =>
        round.map(([home, away]) => [away, home] as [string, string])
      );
      rounds = [...rounds, ...secondHalf];
    }

    // Get the play nights for this division sorted by day
    const playNights = division.playNights.sort(
      (a, b) => a.timeSlot.dayOfWeek - b.timeSlot.dayOfWeek
    );

    if (playNights.length === 0) {
      return NextResponse.json(
        { error: 'No play nights configured for this division' },
        { status: 400 }
      );
    }

    // Get all courts - all courts are available at each time slot
    const allCourts = await prisma.court.findMany({
      orderBy: { name: 'asc' },
    });

    if (allCourts.length === 0) {
      return NextResponse.json(
        { error: 'No courts configured. Please add courts first.' },
        { status: 400 }
      );
    }

    // Create games based on the schedule
    const games = [];
    // Parse the date string (YYYY-MM-DD) to avoid timezone issues
    // Using noon local time prevents date shifting across timezones
    const [year, month, day] = startDate.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day, 12, 0, 0);
    let roundIndex = 0;

    while (roundIndex < rounds.length) {
      const dayOfWeek = currentDate.getDay();

      // Find a matching play night for this day
      const matchingPlayNight = playNights.find(
        (pn) => pn.timeSlot.dayOfWeek === dayOfWeek
      );

      if (matchingPlayNight) {
        const roundMatches = rounds[roundIndex];

        for (let i = 0; i < roundMatches.length; i++) {
          const [homeTeamId, awayTeamId] = roundMatches[i];
          // Assign courts in rotation
          const court = allCourts[i % allCourts.length];

          const game = await prisma.game.create({
            data: {
              seasonId: division.seasonId,
              homeTeamId,
              awayTeamId,
              scheduledDate: new Date(currentDate),
              timeSlotId: matchingPlayNight.timeSlotId,
              courtId: court.id,
            },
          });
          games.push(game);
        }

        roundIndex++;
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);

      // Safety check to prevent infinite loop
      if (currentDate > new Date(division.season.endDate)) {
        break;
      }
    }

    return NextResponse.json({
      message: `Successfully created ${games.length} games`,
      gamesCreated: games.length,
      rounds: rounds.length,
    });
  } catch (error) {
    console.error('Error auto-scheduling:', error);
    return NextResponse.json({ error: 'Failed to auto-schedule' }, { status: 500 });
  }
}
