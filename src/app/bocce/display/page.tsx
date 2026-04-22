'use client';

import { useState, useEffect } from 'react';
import Bracket from '@/components/Bracket';

interface Team {
  id: string;
  name: string;
}

interface Court {
  id: string;
  name: string;
  location: string | null;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
}

interface Game {
  id: string;
  scheduledDate: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  court: Court | null;
  timeSlot: TimeSlot | null;
  isPlayoff?: boolean;
  playoffRound?: number | null;
  playoffPosition?: number | null;
  nextGameId?: string | null;
  nextGamePosition?: string | null;
}

interface Standing {
  id: string;
  team: Team;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface Division {
  id: string;
  name: string;
  standings: Standing[];
}

interface Settings {
  leagueName: string;
  primaryColor: string;
  secondaryColor: string;
  currentDivisionId: string | null;
}

const ROTATION_INTERVAL = 10000; // 10 seconds

export default function TVDisplayPage() {
  const [currentView, setCurrentView] = useState<'schedule' | 'bracket' | 'standings'>('schedule');
  const [todayGames, setTodayGames] = useState<Game[]>([]);
  const [playoffGames, setPlayoffGames] = useState<Game[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasPlayoffs, setHasPlayoffs] = useState(false);
  const [isTournamentDay, setIsTournamentDay] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      const [gamesRes, divisionsRes, settingsRes] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/divisions'),
        fetch('/api/settings'),
      ]);

      const [gamesData, divisionsData, settingsData] = await Promise.all([
        gamesRes.json(),
        divisionsRes.json(),
        settingsRes.json(),
      ]);

      // Filter for today's games or scheduled games
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const filtered = gamesData.filter((game: Game) => {
        const gameDate = new Date(game.scheduledDate);
        return gameDate >= today && gameDate < tomorrow && game.status !== 'cancelled';
      });

      // Get playoff games (filter to today's playoffs if any)
      const todayPlayoffs = gamesData.filter((g: Game) => {
        if (!g.isPlayoff) return false;
        const gameDate = new Date(g.scheduledDate);
        return gameDate >= today && gameDate < tomorrow;
      });
      const allPlayoffs = gamesData.filter((g: Game) => g.isPlayoff);

      // Use today's playoffs if available, otherwise all playoffs
      const playoffs = todayPlayoffs.length > 0 ? todayPlayoffs : allPlayoffs;
      setPlayoffGames(playoffs);
      setHasPlayoffs(playoffs.length > 0);

      // Detect tournament day: multiple games today with playoffs
      const isTournament = filtered.length >= 3 && todayPlayoffs.length > 0;
      setIsTournamentDay(isTournament);

      setTodayGames(filtered.length > 0 ? filtered : gamesData.filter((g: Game) => g.status === 'scheduled').slice(0, 6));
      setDivisions(divisionsData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh data every 30 seconds
    const dataInterval = setInterval(fetchData, 30000);
    return () => clearInterval(dataInterval);
  }, []);

  // Update clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Auto-rotate views
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setCurrentView((prev) => {
        if (hasPlayoffs) {
          // Tournament mode: rotate schedule -> bracket -> standings
          if (prev === 'schedule') return 'bracket';
          if (prev === 'bracket') return 'standings';
          return 'schedule';
        } else {
          // Regular mode: just schedule and standings
          return prev === 'schedule' ? 'standings' : 'schedule';
        }
      });
    }, ROTATION_INTERVAL);
    return () => clearInterval(rotationInterval);
  }, [hasPlayoffs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-white text-4xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark text-white overflow-hidden">
      {/* Header */}
      <header className="bg-black/20 py-4 px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-2xl">GC</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">{settings?.leagueName || 'Bocce League'}</h1>
              <p className="text-white/70 text-lg">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold font-mono">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="text-white/70">
              {currentView === 'schedule' ? 'Schedule' : currentView === 'bracket' ? 'Bracket' : 'Standings'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 h-[calc(100vh-120px)]">
        {currentView === 'schedule' ? (
          <ScheduleView games={todayGames} />
        ) : currentView === 'bracket' ? (
          <BracketView games={playoffGames} />
        ) : (
          <StandingsView divisions={divisions} currentDivisionId={settings?.currentDivisionId} />
        )}
      </main>

      {/* View Indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        <div
          className={`w-3 h-3 rounded-full transition-all ${
            currentView === 'schedule' ? 'bg-secondary scale-125' : 'bg-white/30'
          }`}
        />
        {hasPlayoffs && (
          <div
            className={`w-3 h-3 rounded-full transition-all ${
              currentView === 'bracket' ? 'bg-secondary scale-125' : 'bg-white/30'
            }`}
          />
        )}
        <div
          className={`w-3 h-3 rounded-full transition-all ${
            currentView === 'standings' ? 'bg-secondary scale-125' : 'bg-white/30'
          }`}
        />
      </div>
    </div>
  );
}

function ScheduleView({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <svg
            className="w-24 h-24 mx-auto text-white/50 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h2 className="text-4xl font-bold mb-2">No Games Today</h2>
          <p className="text-xl text-white/70">Check back on game day!</p>
        </div>
      </div>
    );
  }

  // Group games by time slot
  const gamesByTime = games.reduce((acc, game) => {
    const time = game.timeSlot?.startTime || 'TBD';
    if (!acc[time]) acc[time] = [];
    acc[time].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  const timeSlots = Object.keys(gamesByTime).sort();

  return (
    <div className="h-full overflow-auto">
      <h2 className="text-4xl font-bold mb-6 text-center">
        Today&apos;s Schedule
      </h2>
      <div className="space-y-6">
        {timeSlots.map((time) => (
          <div key={time} className="bg-white/10 backdrop-blur rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-secondary mb-4">{time}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {gamesByTime[time].map((game) => (
                <div
                  key={game.id}
                  className={`p-4 rounded-xl ${
                    game.isPlayoff ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-white/5'
                  }`}
                >
                  {/* Court */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="px-2 py-0.5 bg-secondary text-primary text-sm rounded font-bold">
                      {game.court?.name || 'TBD'}
                    </span>
                    {game.isPlayoff && (
                      <span className="text-yellow-400 text-xs font-bold">PLAYOFF</span>
                    )}
                  </div>

                  {/* Matchup */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`font-semibold ${game.status === 'completed' && game.homeScore! > game.awayScore! ? 'text-green-400' : ''}`}>
                        {game.homeTeam?.name || 'TBD'}
                      </span>
                      {game.status === 'completed' && (
                        <span className="font-bold text-xl">{game.homeScore}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-semibold ${game.status === 'completed' && game.awayScore! > game.homeScore! ? 'text-green-400' : ''}`}>
                        {game.awayTeam?.name || 'TBD'}
                      </span>
                      {game.status === 'completed' && (
                        <span className="font-bold text-xl">{game.awayScore}</span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  {game.status === 'in_progress' && (
                    <div className="mt-2 text-center">
                      <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded animate-pulse">
                        LIVE
                      </span>
                    </div>
                  )}
                  {game.status === 'completed' && (
                    <div className="mt-2 text-center">
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                        FINAL
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketView({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold">No Bracket Available</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <h2 className="text-4xl font-bold mb-6 text-center">Tournament Bracket</h2>
      <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
        <Bracket
          games={games.map(g => ({
            id: g.id,
            playoffRound: g.playoffRound || 1,
            playoffPosition: g.playoffPosition || 0,
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            homeScore: g.homeScore,
            awayScore: g.awayScore,
            status: g.status,
            nextGameId: g.nextGameId || null,
            nextGamePosition: g.nextGamePosition || null,
            court: g.court ? { name: g.court.name } : null,
            timeSlot: g.timeSlot ? { startTime: g.timeSlot.startTime } : null,
          }))}
          compact={false}
          showControls={false}
        />
      </div>
    </div>
  );
}

function StandingsView({ divisions, currentDivisionId }: { divisions: Division[]; currentDivisionId?: string | null }) {
  // Filter to show only the current division if set
  const filteredDivisions = currentDivisionId
    ? divisions.filter(d => d.id === currentDivisionId)
    : divisions;

  if (filteredDivisions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold">No Standings Available</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <h2 className="text-4xl font-bold mb-6 text-center">
        {currentDivisionId ? filteredDivisions[0]?.name + ' Standings' : 'Standings'}
      </h2>
      <div className={`grid gap-8 ${filteredDivisions.length === 1 ? 'grid-cols-1 max-w-3xl mx-auto' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {filteredDivisions.map((division) => (
          <div key={division.id} className="bg-white/10 backdrop-blur rounded-2xl p-6">
            <h3 className="text-2xl font-bold mb-4 text-secondary">{division.name}</h3>
            <table className="w-full">
              <thead>
                <tr className="text-white/70 text-left border-b border-white/20">
                  <th className="py-2 text-lg">#</th>
                  <th className="py-2 text-lg">Team</th>
                  <th className="py-2 text-lg text-center">W</th>
                  <th className="py-2 text-lg text-center">L</th>
                  <th className="py-2 text-lg text-center">PF</th>
                  <th className="py-2 text-lg text-center">PA</th>
                </tr>
              </thead>
              <tbody>
                {division.standings
                  ?.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
                  .map((standing, index) => (
                    <tr
                      key={standing.id}
                      className={`border-b border-white/10 ${
                        index < 4 ? 'text-white' : 'text-white/70'
                      }`}
                    >
                      <td className="py-3 text-xl font-bold">{index + 1}</td>
                      <td className="py-3 text-xl font-semibold">{standing.team.name}</td>
                      <td className="py-3 text-xl text-center font-bold text-green-400">
                        {standing.wins}
                      </td>
                      <td className="py-3 text-xl text-center font-bold text-red-400">
                        {standing.losses}
                      </td>
                      <td className="py-3 text-xl text-center">{standing.pointsFor}</td>
                      <td className="py-3 text-xl text-center">{standing.pointsAgainst}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
