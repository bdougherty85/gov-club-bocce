'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface TeamPlayer {
  player: Player;
  isCaptain: boolean;
  isCoach: boolean;
}

interface Team {
  id: string;
  name: string;
  teamPlayers: TeamPlayer[];
}

interface PlayerAvailability {
  playerId: string;
  isAvailable: boolean;
  notes: string | null;
}

interface Lineup {
  id: string;
  playerId: string;
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
  weekNumber: number | null;
  lineups: Lineup[];
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

export default function LineupsPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lineupModalOpen, setLineupModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedLineupTeam, setSelectedLineupTeam] = useState<Team | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerAvailability, setPlayerAvailability] = useState<Map<string, PlayerAvailability>>(new Map());
  const [savingLineup, setSavingLineup] = useState(false);

  const fetchData = async () => {
    try {
      const [seasonsRes, teamsRes] = await Promise.all([
        fetch('/api/seasons'),
        fetch('/api/teams'),
      ]);
      const [seasonsData, teamsData] = await Promise.all([
        seasonsRes.json(),
        teamsRes.json(),
      ]);

      setSeasons(seasonsData);
      setTeams(teamsData);

      // Set default season
      const activeSeason = seasonsData.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    if (!selectedSeason) return;

    try {
      let url = `/api/games?seasonId=${selectedSeason}`;
      if (selectedTeam) {
        url += `&teamId=${selectedTeam}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      // Filter to scheduled and in_progress games
      const upcomingGames = data.filter(
        (g: Game) => g.status === 'scheduled' || g.status === 'in_progress'
      );
      setGames(upcomingGames);
    } catch (error) {
      toast.error('Failed to load games');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchGames();
  }, [selectedSeason, selectedTeam]);

  const openLineupModal = async (game: Game, team: Team) => {
    setSelectedGame(game);
    setSelectedLineupTeam(team);

    // Get existing lineup for this team
    const existingLineup = game.lineups
      .filter((l) => l.teamId === team.id)
      .map((l) => l.playerId);

    setSelectedPlayers(existingLineup);
    setLineupModalOpen(true);

    // Fetch availability for all players on this team for this week
    if (game.weekNumber && selectedSeason) {
      const availabilityMap = new Map<string, PlayerAvailability>();

      await Promise.all(
        team.teamPlayers.map(async ({ player }) => {
          try {
            const res = await fetch(
              `/api/players/${player.id}/availability?seasonId=${selectedSeason}`
            );
            const data = await res.json();
            const weekAvail = data.find(
              (a: { weekNumber: number }) => a.weekNumber === game.weekNumber
            );
            if (weekAvail) {
              availabilityMap.set(player.id, {
                playerId: player.id,
                isAvailable: weekAvail.isAvailable,
                notes: weekAvail.notes,
              });
            } else {
              // Default to available if not set
              availabilityMap.set(player.id, {
                playerId: player.id,
                isAvailable: true,
                notes: null,
              });
            }
          } catch {
            // Default to available on error
            availabilityMap.set(player.id, {
              playerId: player.id,
              isAvailable: true,
              notes: null,
            });
          }
        })
      );

      setPlayerAvailability(availabilityMap);
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const saveLineup = async () => {
    if (!selectedGame || !selectedLineupTeam) return;

    setSavingLineup(true);
    try {
      const res = await fetch(`/api/games/${selectedGame.id}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedLineupTeam.id,
          playerIds: selectedPlayers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for conflict error (player already playing tonight)
        if (data.conflicts) {
          const conflictList = data.conflicts
            .map((c: { player: string; game: string }) => `${c.player} (${c.game})`)
            .join(', ');
          toast.error(`Conflict: ${conflictList}`);
        } else {
          toast.error(data.error || 'Failed to save lineup');
        }
        return;
      }

      toast.success('Lineup saved!');
      setLineupModalOpen(false);
      fetchGames();
    } catch (error) {
      toast.error('Failed to save lineup');
    } finally {
      setSavingLineup(false);
    }
  };

  const getLineupCount = (game: Game, teamId: string) => {
    return game.lineups.filter((l) => l.teamId === teamId).length;
  };

  const getTeamForGame = (game: Game, isHome: boolean) => {
    const teamId = isHome ? game.homeTeam?.id : game.awayTeam?.id;
    return teams.find((t) => t.id === teamId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Lineup Management</h1>
          <p className="text-muted mt-1">Set which players are playing in each game</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
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
          <div className="w-64">
            <Select
              label="Filter by Team"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              options={[
                { value: '', label: 'All Teams' },
                ...teams.map((t) => ({
                  value: t.id,
                  label: t.name,
                })),
              ]}
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading...</div>
      ) : games.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No upcoming games found.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {games.map((game) => {
            const homeTeam = getTeamForGame(game, true);
            const awayTeam = getTeamForGame(game, false);

            return (
              <Card key={game.id}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted mb-1">
                      {new Date(game.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {game.weekNumber && (
                        <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                          Week {game.weekNumber}
                        </span>
                      )}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {game.homeTeam?.name ?? 'TBD'} vs {game.awayTeam?.name ?? 'TBD'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {/* Home Team Lineup */}
                    {homeTeam && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted">
                          {homeTeam.name}: {getLineupCount(game, homeTeam.id)} players
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLineupModal(game, homeTeam)}
                        >
                          Set Lineup
                        </Button>
                      </div>
                    )}

                    {/* Away Team Lineup */}
                    {awayTeam && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted">
                          {awayTeam.name}: {getLineupCount(game, awayTeam.id)} players
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLineupModal(game, awayTeam)}
                        >
                          Set Lineup
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lineup Modal */}
      <Modal
        isOpen={lineupModalOpen}
        onClose={() => setLineupModalOpen(false)}
        title={`Set Lineup - ${selectedLineupTeam?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Select the players who will be playing in this game. Click on a player to
            toggle their selection.
          </p>

          <div className="border border-border rounded-lg divide-y divide-border max-h-96 overflow-y-auto">
            {selectedLineupTeam?.teamPlayers.map(({ player, isCaptain, isCoach }) => {
              const availability = playerAvailability.get(player.id);
              const isAvailable = availability?.isAvailable !== false;

              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    selectedPlayers.includes(player.id) ? 'bg-primary/10' : ''
                  } ${!isAvailable ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedPlayers.includes(player.id)
                          ? 'border-primary bg-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedPlayers.includes(player.id) && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-foreground">
                      {player.firstName} {player.lastName}
                    </span>
                    {isCaptain && (
                      <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-xs rounded">
                        Captain
                      </span>
                    )}
                    {isCoach && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                        Coach
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isAvailable && availability?.notes && (
                      <span className="text-xs text-muted">{availability.notes}</span>
                    )}
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isAvailable ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      title={isAvailable ? 'Available' : 'Unavailable'}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-sm text-muted">
            {selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''} selected
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setLineupModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveLineup} disabled={savingLineup}>
              {savingLineup ? 'Saving...' : 'Save Lineup'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
