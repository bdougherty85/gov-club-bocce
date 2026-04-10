import Link from 'next/link';
import prisma from '@/lib/prisma';
import Card from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const [
    playerCount,
    teamCount,
    activeSeason,
    upcomingGames,
    recentGames,
  ] = await Promise.all([
    prisma.player.count({ where: { isActive: true } }),
    prisma.team.count(),
    prisma.season.findFirst({ where: { isActive: true }, include: { divisions: true } }),
    prisma.game.findMany({
      where: { status: 'scheduled' },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { scheduledDate: 'asc' },
      take: 5,
    }),
    prisma.game.findMany({
      where: { status: 'completed' },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { scheduledDate: 'desc' },
      take: 5,
    }),
  ]);

  return { playerCount, teamCount, activeSeason, upcomingGames, recentGames };
}

export default async function Dashboard() {
  const { playerCount, teamCount, activeSeason, upcomingGames, recentGames } = await getDashboardData();

  const stats = [
    { label: 'Active Players', value: playerCount, href: '/players', color: 'bg-primary' },
    { label: 'Teams', value: teamCount, href: '/teams', color: 'bg-secondary' },
    { label: 'Divisions', value: activeSeason?.divisions.length || 0, href: '/divisions', color: 'bg-primary-light' },
    { label: 'Season', value: activeSeason?.name || 'None', href: '/settings', color: 'bg-accent' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted mt-1">Welcome to the Governors Club Bocce League Manager</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className={`${stat.color} rounded-xl p-6 text-white hover:opacity-90 transition-opacity`}>
              <p className="text-sm font-medium opacity-80">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Link
          href="/players"
          className="bg-white rounded-lg p-4 text-center shadow hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">Manage Players</span>
        </Link>
        <Link
          href="/teams"
          className="bg-white rounded-lg p-4 text-center shadow hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">Manage Teams</span>
        </Link>
        <Link
          href="/schedule"
          className="bg-white rounded-lg p-4 text-center shadow hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">Schedule</span>
        </Link>
        <Link
          href="/standings"
          className="bg-white rounded-lg p-4 text-center shadow hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">Standings</span>
        </Link>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Games */}
        <Card title="Upcoming Games" action={<Link href="/games" className="text-sm text-primary hover:underline">View All</Link>}>
          {upcomingGames.length === 0 ? (
            <p className="text-muted text-center py-4">No upcoming games scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map((game) => (
                <div key={game.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">
                      {game.homeTeam.name} vs {game.awayTeam.name}
                    </p>
                    <p className="text-sm text-muted">
                      {new Date(game.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                    Scheduled
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Results */}
        <Card title="Recent Results" action={<Link href="/games" className="text-sm text-primary hover:underline">View All</Link>}>
          {recentGames.length === 0 ? (
            <p className="text-muted text-center py-4">No completed games yet</p>
          ) : (
            <div className="space-y-3">
              {recentGames.map((game) => (
                <div key={game.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">
                      {game.homeTeam.name} {game.homeScore} - {game.awayScore} {game.awayTeam.name}
                    </p>
                    <p className="text-sm text-muted">
                      {new Date(game.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">
                    Final
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
