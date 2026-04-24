'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

interface Settings {
  leagueName: string;
  primaryColor: string;
  secondaryColor: string;
  currentDivisionId: string | null;
}

interface ScheduleData {
  games: Game[];
  date: string;
  isToday: boolean;
}

const ROTATION_INTERVAL = 15000; // 15 seconds between views

export default function TVDisplayPage() {
  const [currentView, setCurrentView] = useState<'schedule' | 'bracket'>('schedule');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({ games: [], date: '', isToday: true });
  const [playoffGames, setPlayoffGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasPlayoffs, setHasPlayoffs] = useState(false);

  // Parse time string (e.g., "9:00" or "13:30") to minutes since midnight
  const parseTimeToMinutes = useCallback((timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }, []);

  // Get current time in minutes since midnight
  const getCurrentMinutes = useCallback((date: Date): number => {
    return date.getHours() * 60 + date.getMinutes();
  }, []);

  // Advance to next view (called on click)
  const advanceView = () => {
    setCurrentView((prev) => {
      if (hasPlayoffs) {
        return prev === 'schedule' ? 'bracket' : 'schedule';
      }
      return 'schedule';
    });
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [gamesRes, settingsRes] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/settings'),
      ]);

      const [gamesData, settingsData] = await Promise.all([
        gamesRes.json(),
        settingsRes.json(),
      ]);

      // Get today's date string (YYYY-MM-DD) to match against game dates
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Filter for today's games
      const todayGames = gamesData.filter((game: Game) => {
        const gameDateStr = game.scheduledDate.split('T')[0];
        return gameDateStr === todayStr && game.status !== 'cancelled';
      });

      // If no games today, find the next scheduled date
      let displayGames = todayGames;
      let displayDate = todayStr;
      let isToday = true;

      if (todayGames.length === 0) {
        // Find future scheduled games
        const futureGames = gamesData
          .filter((game: Game) => {
            const gameDateStr = game.scheduledDate.split('T')[0];
            return gameDateStr > todayStr && game.status === 'scheduled';
          })
          .sort((a: Game, b: Game) => a.scheduledDate.localeCompare(b.scheduledDate));

        if (futureGames.length > 0) {
          // Get the next game date
          const nextDate = futureGames[0].scheduledDate.split('T')[0];
          displayGames = futureGames.filter((g: Game) => g.scheduledDate.split('T')[0] === nextDate);
          displayDate = nextDate;
          isToday = false;
        }
      }

      setScheduleData({ games: displayGames, date: displayDate, isToday });

      // Always show all playoff games for bracket (not just today's)
      const allPlayoffs = gamesData.filter((g: Game) => g.isPlayoff);
      setPlayoffGames(allPlayoffs);
      setHasPlayoffs(allPlayoffs.length > 0);

      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh data every 15 seconds to keep bracket up to date
    const dataInterval = setInterval(fetchData, 15000);
    return () => clearInterval(dataInterval);
  }, [fetchData]);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Auto-rotate views
  useEffect(() => {
    if (!hasPlayoffs) return; // Don't rotate if no bracket

    const rotationInterval = setInterval(() => {
      setCurrentView((prev) => (prev === 'schedule' ? 'bracket' : 'schedule'));
    }, ROTATION_INTERVAL);
    return () => clearInterval(rotationInterval);
  }, [hasPlayoffs]);

  // Calculate current and next time slots based on current time
  const { currentSlotGames, nextSlotGames, currentSlotTime, nextSlotTime } = useMemo(() => {
    const { games, isToday } = scheduleData;

    if (games.length === 0) {
      return { currentSlotGames: [], nextSlotGames: [], currentSlotTime: null, nextSlotTime: null };
    }

    // Get unique time slots and sort them
    const timeSlots = [...new Set(games
      .map(g => g.timeSlot?.startTime)
      .filter((t): t is string => t !== null && t !== undefined)
    )].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));

    if (timeSlots.length === 0) {
      return { currentSlotGames: games, nextSlotGames: [], currentSlotTime: null, nextSlotTime: null };
    }

    // If showing future date, just show first two time slots
    if (!isToday) {
      const firstSlot = timeSlots[0];
      const secondSlot = timeSlots[1] || null;
      return {
        currentSlotGames: games.filter(g => g.timeSlot?.startTime === firstSlot),
        nextSlotGames: secondSlot ? games.filter(g => g.timeSlot?.startTime === secondSlot) : [],
        currentSlotTime: firstSlot,
        nextSlotTime: secondSlot,
      };
    }

    const nowMinutes = getCurrentMinutes(currentTime);

    // Find current slot: the latest slot that has started but not all games completed
    // Or if no slots have started, show the first one
    let currentSlotIndex = -1;

    for (let i = 0; i < timeSlots.length; i++) {
      const slotMinutes = parseTimeToMinutes(timeSlots[i]);
      const slotGames = games.filter(g => g.timeSlot?.startTime === timeSlots[i]);
      const allCompleted = slotGames.every(g => g.status === 'completed');

      if (slotMinutes <= nowMinutes) {
        // This slot has started
        if (!allCompleted) {
          currentSlotIndex = i; // Active slot
        } else {
          // All games completed, move to next
          currentSlotIndex = i + 1;
        }
      } else if (currentSlotIndex === -1) {
        // No slot has started yet, show first upcoming
        currentSlotIndex = i;
        break;
      }
    }

    // Ensure we don't go past the end
    if (currentSlotIndex >= timeSlots.length) {
      currentSlotIndex = timeSlots.length - 1;
    }
    if (currentSlotIndex < 0) {
      currentSlotIndex = 0;
    }

    const currentSlot = timeSlots[currentSlotIndex];
    const nextSlot = timeSlots[currentSlotIndex + 1] || null;

    const currentGames = games.filter(g => g.timeSlot?.startTime === currentSlot);
    const nextGames = nextSlot ? games.filter(g => g.timeSlot?.startTime === nextSlot) : [];

    return {
      currentSlotGames: currentGames,
      nextSlotGames: nextGames,
      currentSlotTime: currentSlot,
      nextSlotTime: nextSlot,
    };
  }, [scheduleData, currentTime, parseTimeToMinutes, getCurrentMinutes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-white text-4xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-primary to-primary-dark text-white overflow-hidden cursor-pointer"
      onClick={advanceView}
    >
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
              {currentView === 'schedule' ? 'Court Schedule' : 'Tournament Bracket'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 h-[calc(100vh-120px)]">
        {currentView === 'schedule' ? (
          <ScheduleView
            currentSlotGames={currentSlotGames}
            nextSlotGames={nextSlotGames}
            currentSlotTime={currentSlotTime}
            nextSlotTime={nextSlotTime}
            currentTime={currentTime}
            scheduleDate={scheduleData.date}
            isToday={scheduleData.isToday}
          />
        ) : (
          <BracketView games={playoffGames} />
        )}
      </main>

      {/* View Indicator */}
      {hasPlayoffs && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          <div
            className={`w-3 h-3 rounded-full transition-all ${
              currentView === 'schedule' ? 'bg-secondary scale-125' : 'bg-white/30'
            }`}
          />
          <div
            className={`w-3 h-3 rounded-full transition-all ${
              currentView === 'bracket' ? 'bg-secondary scale-125' : 'bg-white/30'
            }`}
          />
        </div>
      )}
    </div>
  );
}

function ScheduleView({
  currentSlotGames,
  nextSlotGames,
  currentSlotTime,
  nextSlotTime,
  currentTime,
  scheduleDate,
  isToday,
}: {
  currentSlotGames: Game[];
  nextSlotGames: Game[];
  currentSlotTime: string | null;
  nextSlotTime: string | null;
  currentTime: Date;
  scheduleDate: string;
  isToday: boolean;
}) {
  if (currentSlotGames.length === 0 && nextSlotGames.length === 0) {
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
          <h2 className="text-4xl font-bold mb-2">No Upcoming Games</h2>
          <p className="text-xl text-white/70">Check back later!</p>
        </div>
      </div>
    );
  }

  // Sort games by court name
  const sortByCourt = (games: Game[]) =>
    [...games].sort((a, b) => (a.court?.name || '').localeCompare(b.court?.name || ''));

  const sortedCurrentGames = sortByCourt(currentSlotGames);
  const sortedNextGames = sortByCourt(nextSlotGames);

  // Check if current slot is happening now or upcoming
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentSlotMinutes = currentSlotTime ? parseTimeToMinutes(currentSlotTime) : 0;
  const isCurrentSlotActive = isToday && currentSlotTime && currentSlotMinutes <= nowMinutes;
  const allCurrentCompleted = currentSlotGames.every(g => g.status === 'completed');

  // Format the schedule date for display
  const formatScheduleDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold">Court Schedule</h2>
        {!isToday && (
          <p className="text-2xl text-secondary mt-2">
            Next Games: {formatScheduleDate(scheduleDate)}
          </p>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-auto">
        {/* Current Time Slot */}
        {currentSlotGames.length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-3xl font-bold text-secondary">
                {currentSlotTime || 'Current'}
              </h3>
              {isToday ? (
                <>
                  {isCurrentSlotActive && !allCurrentCompleted && (
                    <span className="px-4 py-1 bg-green-500 text-white text-lg font-bold rounded-full animate-pulse">
                      NOW PLAYING
                    </span>
                  )}
                  {allCurrentCompleted && (
                    <span className="px-4 py-1 bg-gray-500 text-white text-lg font-bold rounded-full">
                      COMPLETED
                    </span>
                  )}
                  {!isCurrentSlotActive && !allCurrentCompleted && (
                    <span className="px-4 py-1 bg-blue-500 text-white text-lg font-bold rounded-full">
                      UPCOMING
                    </span>
                  )}
                </>
              ) : (
                <span className="px-4 py-1 bg-blue-500 text-white text-lg font-bold rounded-full">
                  SCHEDULED
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedCurrentGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}

        {/* Next Time Slot */}
        {nextSlotGames.length > 0 && (
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white/70">
                Up Next: {nextSlotTime}
              </h3>
              <span className="px-3 py-1 bg-white/20 text-white/70 text-sm font-bold rounded-full">
                ON DECK
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedNextGames.map((game) => (
                <GameCard key={game.id} game={game} dimmed />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, dimmed = false }: { game: Game; dimmed?: boolean }) {
  const isLive = game.status === 'in_progress';
  const isCompleted = game.status === 'completed';
  const homeWon = isCompleted && game.homeScore! > game.awayScore!;
  const awayWon = isCompleted && game.awayScore! > game.homeScore!;

  return (
    <div
      className={`p-4 rounded-xl transition-all ${
        isLive
          ? 'bg-yellow-500/30 border-2 border-yellow-500 animate-pulse'
          : game.isPlayoff
            ? 'bg-yellow-500/20 border border-yellow-500/50'
            : dimmed
              ? 'bg-white/5'
              : 'bg-white/10'
      } ${dimmed ? 'opacity-70' : ''}`}
    >
      {/* Court Header */}
      <div className="flex justify-between items-center mb-3">
        <span className={`px-3 py-1 bg-secondary text-primary font-bold rounded ${dimmed ? 'text-sm' : 'text-base'}`}>
          {game.court?.name || 'TBD'}
        </span>
        {game.isPlayoff && (
          <span className={`text-yellow-400 font-bold ${dimmed ? 'text-xs' : 'text-sm'}`}>
            PLAYOFF
          </span>
        )}
        {isLive && (
          <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded">
            LIVE
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <div className={`flex justify-between items-center ${dimmed ? 'text-base' : 'text-lg'}`}>
          <span className={`font-semibold truncate flex-1 ${homeWon ? 'text-green-400' : ''}`}>
            {game.homeTeam?.name || 'TBD'}
          </span>
          {isCompleted && (
            <span className={`font-bold text-2xl ml-2 ${homeWon ? 'text-green-400' : 'text-white/50'}`}>
              {game.homeScore}
            </span>
          )}
        </div>
        <div className={`flex justify-between items-center ${dimmed ? 'text-base' : 'text-lg'}`}>
          <span className={`font-semibold truncate flex-1 ${awayWon ? 'text-green-400' : ''}`}>
            {game.awayTeam?.name || 'TBD'}
          </span>
          {isCompleted && (
            <span className={`font-bold text-2xl ml-2 ${awayWon ? 'text-green-400' : 'text-white/50'}`}>
              {game.awayScore}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      {isCompleted && (
        <div className="mt-3 text-center">
          <span className="px-3 py-1 bg-green-500/30 text-green-400 text-sm font-bold rounded">
            FINAL
          </span>
        </div>
      )}
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
        darkMode={true}
      />
    </div>
  );
}
