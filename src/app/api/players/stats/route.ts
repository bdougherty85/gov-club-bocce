import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get stats for all players (summary view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const teamId = searchParams.get('teamId');

    // Get all players with their team associations
    const players = await prisma.player.findMany({
      where: {
        isActive: true,
        ...(teamId && {
          teamPlayers: {
            some: { teamId },
          },
        }),
      },
      include: {
        teamPlayers: {
          include: {
            team: {
              include: {
                division: {
                  include: {
                    season: true,
                  },
                },
              },
            },
          },
          ...(seasonId && {
            where: {
              team: {
                division: {
                  seasonId,
                },
              },
            },
          }),
        },
        gameLineups: {
          ...(seasonId && {
            where: {
              game: {
                seasonId,
              },
            },
          }),
        },
        stats: {
          ...(seasonId && {
            where: {
              game: {
                seasonId,
              },
            },
          }),
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const playerStats = players.map((player) => {
      const gamesPlayed = player.gameLineups.length;
      const totalPoints = player.stats.reduce((sum, s) => sum + s.points, 0);
      const totalWins = player.stats.reduce((sum, s) => sum + s.wins, 0);
      const gamesWithStats = player.stats.length;

      return {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        fullName: `${player.firstName} ${player.lastName}`,
        teams: player.teamPlayers.map((tp) => ({
          teamId: tp.team.id,
          teamName: tp.team.name,
          divisionName: tp.team.division.name,
          isCaptain: tp.isCaptain,
        })),
        gamesPlayed,
        totalPoints,
        totalWins,
        gamesWithStats,
        averagePointsPerGame:
          gamesWithStats > 0 ? parseFloat((totalPoints / gamesWithStats).toFixed(1)) : 0,
      };
    });

    // Sort by games played, then by points
    playerStats.sort((a, b) => {
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return b.totalPoints - a.totalPoints;
    });

    return NextResponse.json(playerStats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json({ error: 'Failed to fetch player stats' }, { status: 500 });
  }
}
