'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface Lineup {
  player: Player;
  teamId: string;
}

interface Game {
  id: string;
  scheduledDate: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  isConfirmed: boolean;
  confirmedAt: string | null;
  weekNumber: number | null;
  lineups: Lineup[];
}

interface WeekData {
  weekNumber: number;
  weekStart: string;
  games: Game[];
  totalGames: number;
  completedGames: number;
  confirmedGames: number;
  allConfirmed: boolean;
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

export default function ReviewPage() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const fetchSeasons = async () => {
    try {
      const res = await fetch('/api/seasons');
      const data = await res.json();
      setSeasons(data);

      const activeSeason = data.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }
    } catch (error) {
      toast.error('Failed to load seasons');
    }
  };

  const fetchWeeklyGames = async () => {
    if (!selectedSeason) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/games/weekly?seasonId=${selectedSeason}`);
      const data = await res.json();
      setWeeks(data);
    } catch (error) {
      toast.error('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      setLoading(true);
      fetchWeeklyGames();
    }
  }, [selectedSeason]);

  const confirmGame = async (gameId: string) => {
    try {
      const res = await fetch(`/api/games/${gameId}/confirm`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to confirm');
      }

      toast.success('Game confirmed!');
      fetchWeeklyGames();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm game');
    }
  };

  const unconfirmGame = async (gameId: string) => {
    try {
      const res = await fetch(`/api/games/${gameId}/confirm`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to unconfirm');

      toast.success('Game unconfirmed - you can now edit it');
      fetchWeeklyGames();
    } catch (error) {
      toast.error('Failed to unconfirm game');
    }
  };

  const confirmWeek = async (weekNumber: number) => {
    try {
      const res = await fetch('/api/games/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeason,
          weekNumber,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to confirm week');
      }

      const result = await res.json();
      toast.success(result.message);
      fetchWeeklyGames();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm week');
    }
  };

  const getStatusBadge = (game: Game) => {
    if (game.isConfirmed) {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Confirmed
        </span>
      );
    }

    if (game.status === 'completed') {
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
          Pending Review
        </span>
      );
    }

    return (
      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
        {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
      </span>
    );
  };

  const getWeekStatusBadge = (week: WeekData) => {
    if (week.allConfirmed) {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          All Confirmed
        </span>
      );
    }

    if (week.completedGames === week.totalGames && week.completedGames > 0) {
      return (
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
          Ready for Review ({week.confirmedGames}/{week.totalGames} confirmed)
        </span>
      );
    }

    return (
      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
        {week.completedGames}/{week.totalGames} completed
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Score Review</h1>
          <p className="text-muted mt-1">Review and confirm weekly game scores</p>
        </div>
      </div>

      {/* Season Selector */}
      <Card className="mb-6">
        <div className="w-64">
          <Select
            label="Season"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            options={[
              { value: '', label: 'Select season...' },
              ...seasons.map((s) => ({
                value: s.id,
                label: `${s.name}${s.isActive ? ' (Active)' : ''}`,
              })),
            ]}
          />
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading...</div>
      ) : weeks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No games found for this season.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {weeks.map((week) => (
            <Card key={week.weekNumber}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedWeek(expandedWeek === week.weekNumber ? null : week.weekNumber)
                }
              >
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Week {week.weekNumber}
                    </h3>
                    <p className="text-sm text-muted">
                      {new Date(week.weekStart).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {getWeekStatusBadge(week)}
                </div>

                <div className="flex items-center gap-3">
                  {!week.allConfirmed &&
                    week.completedGames === week.totalGames &&
                    week.completedGames > 0 && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmWeek(week.weekNumber);
                        }}
                      >
                        Confirm All
                      </Button>
                    )}
                  <svg
                    className={`w-5 h-5 text-muted transition-transform ${
                      expandedWeek === week.weekNumber ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {expandedWeek === week.weekNumber && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="space-y-3">
                    {week.games.map((game) => (
                      <div
                        key={game.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-medium text-foreground">
                              {game.homeTeam?.name ?? 'TBD'} vs {game.awayTeam?.name ?? 'TBD'}
                            </p>
                            {getStatusBadge(game)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted">
                            <span>
                              {new Date(game.scheduledDate).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            {game.status === 'completed' && (
                              <span className="font-semibold text-foreground">
                                Score: {game.homeScore} - {game.awayScore}
                              </span>
                            )}
                            {game.lineups.length > 0 && (
                              <span>
                                {game.lineups.length} player{game.lineups.length !== 1 ? 's' : ''} recorded
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {game.status === 'completed' && !game.isConfirmed && (
                            <Button size="sm" onClick={() => confirmGame(game.id)}>
                              Confirm
                            </Button>
                          )}
                          {game.isConfirmed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unconfirmGame(game.id)}
                            >
                              Unconfirm
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
