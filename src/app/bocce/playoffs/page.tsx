'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
}

interface BracketGame {
  id: string | null;
  round: number;
  position: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: Team | null;
  bracket: 'winners' | 'losers' | null;
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

interface Division {
  id: string;
  name: string;
  season: Season;
}

export default function PlayoffsPage() {
  const [bracket, setBracket] = useState<{ format: string; games: BracketGame[] } | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [formData, setFormData] = useState({
    seasonId: '',
    divisionIds: [] as string[],
  });

  const fetchData = async () => {
    try {
      const [seasonsRes, divisionsRes] = await Promise.all([
        fetch('/api/seasons'),
        fetch('/api/divisions'),
      ]);
      const [seasonsData, divisionsData] = await Promise.all([
        seasonsRes.json(),
        divisionsRes.json(),
      ]);
      setSeasons(seasonsData);
      setDivisions(divisionsData);

      // Set default season to active one
      const activeSeason = seasonsData.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
        setFormData((prev) => ({ ...prev, seasonId: activeSeason.id }));
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBracket = async (seasonId: string) => {
    if (!seasonId) return;

    try {
      const res = await fetch(`/api/playoffs/bracket?seasonId=${seasonId}`);
      const data = await res.json();
      setBracket(data);
    } catch (error) {
      console.error('Failed to fetch bracket');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchBracket(selectedSeason);
    }
  }, [selectedSeason]);

  const handleGenerateBracket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.divisionIds.length === 0) {
      toast.error('Please select at least one division');
      return;
    }

    try {
      const res = await fetch('/api/playoffs/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate bracket');
      }

      const result = await res.json();
      toast.success(result.message);
      setModalOpen(false);
      fetchBracket(formData.seasonId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate bracket');
    }
  };

  const toggleDivision = (divisionId: string) => {
    setFormData((prev) => ({
      ...prev,
      divisionIds: prev.divisionIds.includes(divisionId)
        ? prev.divisionIds.filter((id) => id !== divisionId)
        : [...prev.divisionIds, divisionId],
    }));
  };

  const getRoundName = (round: number, totalRounds: number) => {
    const diff = totalRounds - round;
    if (diff === 0) return 'Finals';
    if (diff === 1) return 'Semi-Finals';
    if (diff === 2) return 'Quarter-Finals';
    return `Round ${round}`;
  };

  // Group games by round
  const gamesByRound = bracket?.games?.reduce((acc, game) => {
    if (!acc[game.round]) acc[game.round] = [];
    acc[game.round].push(game);
    return acc;
  }, {} as Record<number, BracketGame[]>) || {};

  const maxRound = Math.max(...Object.keys(gamesByRound).map(Number), 0);

  const seasonDivisions = divisions.filter(
    (d) => d.season.id === (formData.seasonId || selectedSeason)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Playoffs</h1>
          <p className="text-muted mt-1">
            View and manage playoff brackets
            {bracket?.format && (
              <span className="ml-2 px-2 py-1 bg-accent/10 text-accent text-xs rounded">
                {bracket.format === 'single' ? 'Single Elimination' : 'Double Elimination'}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Generate Bracket</Button>
      </div>

      {/* Season Selector */}
      <Card className="mb-6">
        <div className="w-64">
          <Select
            label="Season"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            options={[
              { value: '', label: 'Select a season...' },
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
      ) : !bracket || bracket.games.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-muted mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Playoff Bracket</h3>
            <p className="text-muted mb-4">
              Generate a playoff bracket based on the current standings.
            </p>
            <Button onClick={() => setModalOpen(true)}>Generate Bracket</Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-8 min-w-max">
            {Object.entries(gamesByRound)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([round, games]) => (
                <div key={round} className="flex-shrink-0 w-72">
                  <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                    {getRoundName(parseInt(round), maxRound)}
                  </h3>
                  <div className="space-y-4">
                    {games.map((game, idx) => (
                      <Card key={game.id || idx} className="!p-4">
                        {/* Home Team */}
                        <div
                          className={`flex justify-between items-center p-2 rounded ${
                            game.winner?.id === game.homeTeam?.id
                              ? 'bg-success/10'
                              : 'bg-gray-50'
                          }`}
                        >
                          <span
                            className={`font-medium ${
                              game.winner?.id === game.homeTeam?.id
                                ? 'text-success'
                                : 'text-foreground'
                            }`}
                          >
                            {game.homeTeam?.name || 'TBD'}
                          </span>
                          <span className="font-bold text-lg">
                            {game.homeScore ?? '-'}
                          </span>
                        </div>

                        {/* Away Team */}
                        <div
                          className={`flex justify-between items-center p-2 rounded mt-1 ${
                            game.winner?.id === game.awayTeam?.id
                              ? 'bg-success/10'
                              : 'bg-gray-50'
                          }`}
                        >
                          <span
                            className={`font-medium ${
                              game.winner?.id === game.awayTeam?.id
                                ? 'text-success'
                                : 'text-foreground'
                            }`}
                          >
                            {game.awayTeam?.name || 'TBD'}
                          </span>
                          <span className="font-bold text-lg">
                            {game.awayScore ?? '-'}
                          </span>
                        </div>

                        {game.bracket && (
                          <p className="text-xs text-muted text-center mt-2">
                            {game.bracket === 'winners' ? 'Winners Bracket' : 'Losers Bracket'}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Generate Bracket Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Generate Playoff Bracket"
        size="lg"
      >
        <form onSubmit={handleGenerateBracket} className="space-y-4">
          <p className="text-sm text-muted">
            This will generate playoff matchups based on the current standings. Top teams from
            the selected divisions will be seeded into the bracket.
          </p>

          <Select
            label="Season"
            value={formData.seasonId}
            onChange={(e) => setFormData({ ...formData, seasonId: e.target.value, divisionIds: [] })}
            options={[
              { value: '', label: 'Select a season...' },
              ...seasons.map((s) => ({
                value: s.id,
                label: `${s.name}${s.isActive ? ' (Active)' : ''}`,
              })),
            ]}
            required
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Divisions
            </label>
            <div className="space-y-2">
              {seasonDivisions.length === 0 ? (
                <p className="text-sm text-muted">
                  No divisions found for this season.
                </p>
              ) : (
                seasonDivisions.map((division) => (
                  <label
                    key={division.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={formData.divisionIds.includes(division.id)}
                      onChange={() => toggleDivision(division.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-foreground">{division.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={seasonDivisions.length === 0}>
              Generate Bracket
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
