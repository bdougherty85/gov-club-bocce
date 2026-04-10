import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Get comprehensive stats for a player
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    // Get player info
    const player = await prisma.player.findUnique({
      where: { id },
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
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Get games played (from lineups)
    const lineupFilter: { playerId: string; game?: { seasonId: string } } = { playerId: id };
    if (seasonId) {
      lineupFilter.game = { seasonId };
    }

    const gamesPlayed = await prisma.gameLineup.findMany({
      where: lineupFilter,
      include: {
        game: {
          include: {
            homeTeam: true,
            awayTeam: true,
            season: true,
          },
        },
        team: true,
      },
      orderBy: {
        game: {
          scheduledDate: 'desc',
        },
      },
    });

    // Get player stats from games
    const statsFilter: { playerId: string; game?: { seasonId: string } } = { playerId: id };
    if (seasonId) {
      statsFilter.game = { seasonId };
    }

    const playerStats = await prisma.playerStats.findMany({
      where: statsFilter,
      include: {
        game: {
          include: {
            homeTeam: true,
            awayTeam: true,
            season: true,
          },
        },
      },
      orderBy: {
        game: {
          scheduledDate: 'desc',
        },
      },
    });

    // Calculate aggregated stats
    const totalGamesPlayed = gamesPlayed.length;
    const totalPoints = playerStats.reduce((sum, s) => sum + s.points, 0);
    const totalWins = playerStats.reduce((sum, s) => sum + s.wins, 0);
    const totalGamesWithStats = playerStats.length;

    // Group games by season
    const gamesBySeason = gamesPlayed.reduce((acc, lineup) => {
      const seasonName = lineup.game.season.name;
      if (!acc[seasonName]) {
        acc[seasonName] = {
          seasonId: lineup.game.season.id,
          seasonName,
          gamesPlayed: 0,
          points: 0,
          wins: 0,
        };
      }
      acc[seasonName].gamesPlayed++;
      return acc;
    }, {} as Record<string, { seasonId: string; seasonName: string; gamesPlayed: number; points: number; wins: number }>);

    // Add stats to season summaries
    playerStats.forEach((stat) => {
      const seasonName = stat.game.season.name;
      if (gamesBySeason[seasonName]) {
        gamesBySeason[seasonName].points += stat.points;
        gamesBySeason[seasonName].wins += stat.wins;
      }
    });

    return NextResponse.json({
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        email: player.email,
        isActive: player.isActive,
      },
      teams: player.teamPlayers.map((tp) => ({
        teamId: tp.team.id,
        teamName: tp.team.name,
        divisionName: tp.team.division.name,
        seasonName: tp.team.division.season.name,
        isCaptain: tp.isCaptain,
      })),
      summary: {
        totalGamesPlayed,
        totalPoints,
        totalWins,
        totalGamesWithStats,
        averagePointsPerGame: totalGamesWithStats > 0 ? (totalPoints / totalGamesWithStats).toFixed(1) : 0,
      },
      seasonStats: Object.values(gamesBySeason),
      recentGames: gamesPlayed.slice(0, 10).map((lineup) => ({
        gameId: lineup.game.id,
        date: lineup.game.scheduledDate,
        homeTeam: lineup.game.homeTeam?.name ?? 'TBD',
        awayTeam: lineup.game.awayTeam?.name ?? 'TBD',
        homeScore: lineup.game.homeScore,
        awayScore: lineup.game.awayScore,
        teamPlayed: lineup.team.name,
        status: lineup.game.status,
      })),
      detailedStats: playerStats.map((stat) => ({
        gameId: stat.game.id,
        date: stat.game.scheduledDate,
        homeTeam: stat.game.homeTeam?.name ?? 'TBD',
        awayTeam: stat.game.awayTeam?.name ?? 'TBD',
        points: stat.points,
        wins: stat.wins,
      })),
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json({ error: 'Failed to fetch player stats' }, { status: 500 });
  }
}
