'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface TeamInfo {
  teamId: string;
  teamName: string;
  divisionName: string;
  isCaptain: boolean;
}

interface PlayerStats {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  teams: TeamInfo[];
  gamesPlayed: number;
  totalPoints: number;
  totalWins: number;
  gamesWithStats: number;
  averagePointsPerGame: number;
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface DetailedPlayerStats {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  teams: {
    teamId: string;
    teamName: string;
    divisionName: string;
    seasonName: string;
    isCaptain: boolean;
  }[];
  summary: {
    totalGamesPlayed: number;
    totalPoints: number;
    totalWins: number;
    totalGamesWithStats: number;
    averagePointsPerGame: string | number;
  };
  seasonStats: {
    seasonId: string;
    seasonName: string;
    gamesPlayed: number;
    points: number;
    wins: number;
  }[];
  recentGames: {
    gameId: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    teamPlayed: string;
    status: string;
  }[];
}

export default function StatsPage() {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [playerDetails, setPlayerDetails] = useState<DetailedPlayerStats | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'gamesPlayed' | 'totalPoints' | 'averagePointsPerGame'>('gamesPlayed');

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

      const activeSeason = seasonsData.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const fetchPlayerStats = async () => {
    try {
      let url = '/api/players/stats';
      const params = new URLSearchParams();
      if (selectedSeason) params.append('seasonId', selectedSeason);
      if (selectedTeam) params.append('teamId', selectedTeam);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      toast.error('Failed to load player stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerDetails = async (playerId: string) => {
    try {
      let url = `/api/players/${playerId}/stats`;
      if (selectedSeason) url += `?seasonId=${selectedSeason}`;

      const res = await fetch(url);
      const data = await res.json();
      setPlayerDetails(data);
    } catch (error) {
      toast.error('Failed to load player details');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPlayerStats();
  }, [selectedSeason, selectedTeam]);

  const openPlayerDetails = async (player: PlayerStats) => {
    setSelectedPlayer(player);
    setDetailsModalOpen(true);
    await fetchPlayerDetails(player.id);
  };

  const sortedPlayers = [...players].sort((a, b) => {
    if (sortBy === 'gamesPlayed') return b.gamesPlayed - a.gamesPlayed;
    if (sortBy === 'totalPoints') return b.totalPoints - a.totalPoints;
    return b.averagePointsPerGame - a.averagePointsPerGame;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Player Statistics</h1>
          <p className="text-muted mt-1">View player participation and performance stats</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Select
              label="Season"
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              options={[
                { value: '', label: 'All Seasons' },
                ...seasons.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.isActive ? ' (Active)' : ''}`,
                })),
              ]}
            />
          </div>
          <div className="w-48">
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
          <div className="w-48">
            <Select
              label="Sort By"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              options={[
                { value: 'gamesPlayed', label: 'Games Played' },
                { value: 'totalPoints', label: 'Total Points' },
                { value: 'averagePointsPerGame', label: 'Avg Points/Game' },
              ]}
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading...</div>
      ) : players.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No player statistics found.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Team(s)
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Games Played
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Total Points
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Wins
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Avg Pts/Game
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player, index) => (
                  <tr
                    key={player.id}
                    className="border-b border-border hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openPlayerDetails(player)}
                  >
                    <td className="px-4 py-3 text-sm text-muted">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {player.fullName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {player.teams.map((team) => (
                          <span
                            key={team.teamId}
                            className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                          >
                            {team.teamName}
                            {team.isCaptain && ' (C)'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {player.gamesPlayed}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {player.totalPoints}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {player.totalWins}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">
                      {player.averagePointsPerGame}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Player Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setPlayerDetails(null);
          setSelectedPlayer(null);
        }}
        title={selectedPlayer ? `${selectedPlayer.fullName} - Stats` : 'Player Stats'}
        size="lg"
      >
        {!playerDetails ? (
          <div className="text-center py-8 text-muted">Loading player details...</div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {playerDetails.summary.totalGamesPlayed}
                </p>
                <p className="text-sm text-muted">Games Played</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {playerDetails.summary.totalPoints}
                </p>
                <p className="text-sm text-muted">Total Points</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {playerDetails.summary.totalWins}
                </p>
                <p className="text-sm text-muted">Wins</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {playerDetails.summary.averagePointsPerGame}
                </p>
                <p className="text-sm text-muted">Avg Pts/Game</p>
              </div>
            </div>

            {/* Teams */}
            <div>
              <h4 className="font-semibold text-foreground mb-2">Teams</h4>
              <div className="flex flex-wrap gap-2">
                {playerDetails.teams.map((team) => (
                  <span
                    key={team.teamId}
                    className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                  >
                    {team.teamName} - {team.divisionName}
                    {team.isCaptain && ' (Captain)'}
                  </span>
                ))}
              </div>
            </div>

            {/* Season Stats */}
            {playerDetails.seasonStats.length > 0 && (
              <div>
                <h4 className="font-semibold text-foreground mb-2">Season Breakdown</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-muted">
                          Season
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-muted">
                          Games
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-muted">
                          Points
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-muted">
                          Wins
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerDetails.seasonStats.map((stat) => (
                        <tr key={stat.seasonId} className="border-t border-border">
                          <td className="px-4 py-2 text-sm text-foreground">
                            {stat.seasonName}
                          </td>
                          <td className="px-4 py-2 text-center text-sm text-foreground">
                            {stat.gamesPlayed}
                          </td>
                          <td className="px-4 py-2 text-center text-sm text-foreground">
                            {stat.points}
                          </td>
                          <td className="px-4 py-2 text-center text-sm text-foreground">
                            {stat.wins}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Games */}
            {playerDetails.recentGames.length > 0 && (
              <div>
                <h4 className="font-semibold text-foreground mb-2">Recent Games</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-muted">
                          Date
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-muted">
                          Matchup
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-muted">
                          Score
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-muted">
                          Played For
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerDetails.recentGames.map((game) => (
                        <tr key={game.gameId} className="border-t border-border">
                          <td className="px-4 py-2 text-sm text-foreground">
                            {new Date(game.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-2 text-sm text-foreground">
                            {game.homeTeam} vs {game.awayTeam}
                          </td>
                          <td className="px-4 py-2 text-center text-sm text-foreground">
                            {game.status === 'completed'
                              ? `${game.homeScore} - ${game.awayScore}`
                              : game.status}
                          </td>
                          <td className="px-4 py-2 text-sm text-foreground">
                            {game.teamPlayed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
