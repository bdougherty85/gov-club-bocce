import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        homeTeam: {
          include: {
            teamPlayers: {
              include: {
                player: true,
              },
            },
            division: true,
          },
        },
        awayTeam: {
          include: {
            teamPlayers: {
              include: {
                player: true,
              },
            },
            division: true,
          },
        },
        timeSlot: true,
        court: true,
        season: true,
        playerStats: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json({ error: 'Failed to fetch game' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      homeScore,
      awayScore,
      status,
      scoreboardPhoto,
      notes,
      scheduledDate,
      timeSlotId,
      courtId,
      homeTeamId,
      awayTeamId,
      nextGameId,
      nextGamePosition,
      playoffRound,
      playoffPosition,
    } = body;

    // First get the current game to check if it's a playoff game
    const currentGame = await prisma.game.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    if (!currentGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = await prisma.game.update({
      where: { id },
      data: {
        homeScore,
        awayScore,
        status,
        scoreboardPhoto,
        notes,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        timeSlotId,
        courtId,
        homeTeamId,
        awayTeamId,
        nextGameId,
        nextGamePosition,
        playoffRound,
        playoffPosition,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        court: true,
        timeSlot: true,
      },
    });

    // Handle completed games
    if (status === 'completed' && homeScore !== null && awayScore !== null) {
      // If this is a playoff game, advance the winner to the next round
      if (game.isPlayoff && game.nextGameId && game.nextGamePosition) {
        const winnerId = homeScore > awayScore ? game.homeTeamId : game.awayTeamId;

        if (winnerId) {
          // Update the next game with the winner
          const updateData = game.nextGamePosition === 'home'
            ? { homeTeamId: winnerId }
            : { awayTeamId: winnerId };

          await prisma.game.update({
            where: { id: game.nextGameId },
            data: updateData,
          });
        }
      }

      // Update standings for regular season games (not playoffs)
      if (!game.isPlayoff && game.homeTeamId && game.awayTeamId) {
        const homeTeam = await prisma.team.findUnique({
          where: { id: game.homeTeamId },
        });

        if (homeTeam) {
          // Update home team standing
          await prisma.standing.upsert({
            where: {
              teamId_divisionId: {
                teamId: game.homeTeamId,
                divisionId: homeTeam.divisionId,
              },
            },
            update: {
              wins: homeScore > awayScore ? { increment: 1 } : undefined,
              losses: homeScore < awayScore ? { increment: 1 } : undefined,
              pointsFor: { increment: homeScore },
              pointsAgainst: { increment: awayScore },
            },
            create: {
              teamId: game.homeTeamId,
              divisionId: homeTeam.divisionId,
              wins: homeScore > awayScore ? 1 : 0,
              losses: homeScore < awayScore ? 1 : 0,
              pointsFor: homeScore,
              pointsAgainst: awayScore,
            },
          });

          // Update away team standing
          const awayTeam = await prisma.team.findUnique({
            where: { id: game.awayTeamId },
          });

          if (awayTeam) {
            await prisma.standing.upsert({
              where: {
                teamId_divisionId: {
                  teamId: game.awayTeamId,
                  divisionId: awayTeam.divisionId,
                },
              },
              update: {
                wins: awayScore > homeScore ? { increment: 1 } : undefined,
                losses: awayScore < homeScore ? { increment: 1 } : undefined,
                pointsFor: { increment: awayScore },
                pointsAgainst: { increment: homeScore },
              },
              create: {
                teamId: game.awayTeamId,
                divisionId: awayTeam.divisionId,
                wins: awayScore > homeScore ? 1 : 0,
                losses: awayScore < homeScore ? 1 : 0,
                pointsFor: awayScore,
                pointsAgainst: homeScore,
              },
            });
          }
        }
      }
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.game.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}
