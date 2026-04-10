import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get lineup for a specific game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    const whereClause: { gameId: string; teamId?: string } = { gameId: id };
    if (teamId) {
      whereClause.teamId = teamId;
    }

    const lineups = await prisma.gameLineup.findMany({
      where: whereClause,
      include: {
        player: true,
        team: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(lineups);
  } catch (error) {
    console.error('Error fetching lineup:', error);
    return NextResponse.json({ error: 'Failed to fetch lineup' }, { status: 500 });
  }
}

// Set lineup for a game (replace all players for a team)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { teamId, playerIds } = body;

    if (!teamId || !Array.isArray(playerIds)) {
      return NextResponse.json(
        { error: 'teamId and playerIds array are required' },
        { status: 400 }
      );
    }

    // Verify game exists and get its date
    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if any players are already playing in another game on the same night
    if (playerIds.length > 0) {
      const gameDate = new Date(game.scheduledDate);
      const startOfDay = new Date(gameDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(gameDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find other games on the same day where these players are in the lineup
      const conflictingLineups = await prisma.gameLineup.findMany({
        where: {
          playerId: { in: playerIds },
          gameId: { not: id }, // Exclude current game
          game: {
            scheduledDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
        include: {
          player: true,
          game: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
      });

      if (conflictingLineups.length > 0) {
        const conflicts = conflictingLineups.map((l) => ({
          player: `${l.player.firstName} ${l.player.lastName}`,
          game: `${l.game.homeTeam?.name ?? 'TBD'} vs ${l.game.awayTeam?.name ?? 'TBD'}`,
        }));

        return NextResponse.json(
          {
            error: 'Some players are already playing in another game tonight',
            conflicts,
          },
          { status: 400 }
        );
      }
    }

    // Delete existing lineup for this team in this game
    await prisma.gameLineup.deleteMany({
      where: {
        gameId: id,
        teamId: teamId,
      },
    });

    // Create new lineup entries
    if (playerIds.length > 0) {
      await prisma.gameLineup.createMany({
        data: playerIds.map((playerId: string) => ({
          gameId: id,
          teamId: teamId,
          playerId: playerId,
        })),
      });
    }

    // Fetch and return the new lineup
    const lineups = await prisma.gameLineup.findMany({
      where: {
        gameId: id,
        teamId: teamId,
      },
      include: {
        player: true,
        team: true,
      },
    });

    return NextResponse.json(lineups);
  } catch (error) {
    console.error('Error setting lineup:', error);
    return NextResponse.json({ error: 'Failed to set lineup' }, { status: 500 });
  }
}

// Add a single player to lineup
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { teamId, playerId } = body;

    if (!teamId || !playerId) {
      return NextResponse.json(
        { error: 'teamId and playerId are required' },
        { status: 400 }
      );
    }

    // Get game to check date
    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if player is already playing in another game tonight
    const gameDate = new Date(game.scheduledDate);
    const startOfDay = new Date(gameDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(gameDate);
    endOfDay.setHours(23, 59, 59, 999);

    const conflictingLineup = await prisma.gameLineup.findFirst({
      where: {
        playerId,
        gameId: { not: id },
        game: {
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      include: {
        player: true,
        game: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
    });

    if (conflictingLineup) {
      return NextResponse.json(
        {
          error: `${conflictingLineup.player.firstName} ${conflictingLineup.player.lastName} is already playing in ${conflictingLineup.game.homeTeam?.name ?? 'TBD'} vs ${conflictingLineup.game.awayTeam?.name ?? 'TBD'} tonight`,
        },
        { status: 400 }
      );
    }

    // Check if already in lineup
    const existing = await prisma.gameLineup.findUnique({
      where: {
        gameId_teamId_playerId: {
          gameId: id,
          teamId: teamId,
          playerId: playerId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Player already in lineup' }, { status: 400 });
    }

    const lineup = await prisma.gameLineup.create({
      data: {
        gameId: id,
        teamId: teamId,
        playerId: playerId,
      },
      include: {
        player: true,
        team: true,
      },
    });

    return NextResponse.json(lineup);
  } catch (error) {
    console.error('Error adding to lineup:', error);
    return NextResponse.json({ error: 'Failed to add to lineup' }, { status: 500 });
  }
}

// Remove a player from lineup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const playerId = searchParams.get('playerId');

    if (!teamId || !playerId) {
      return NextResponse.json(
        { error: 'teamId and playerId are required' },
        { status: 400 }
      );
    }

    await prisma.gameLineup.delete({
      where: {
        gameId_teamId_playerId: {
          gameId: id,
          teamId: teamId,
          playerId: playerId,
        },
      },
    });

    return NextResponse.json({ message: 'Player removed from lineup' });
  } catch (error) {
    console.error('Error removing from lineup:', error);
    return NextResponse.json({ error: 'Failed to remove from lineup' }, { status: 500 });
  }
}
