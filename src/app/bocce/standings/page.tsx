'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
  teamPlayers: { player: { firstName: string; lastName: string } }[];
}

interface Division {
  id: string;
  name: string;
  season: { id: string; name: string };
}

interface Standing {
  id: string;
  team: Team;
  division: Division;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  winPercentage: number;
  pointDifferential: number;
}

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDivision, setSelectedDivision] = useState('all');

  const fetchData = async () => {
    try {
      const [standingsRes, divisionsRes] = await Promise.all([
        fetch('/api/standings'),
        fetch('/api/divisions'),
      ]);
      const [standingsData, divisionsData] = await Promise.all([
        standingsRes.json(),
        divisionsRes.json(),
      ]);
      setStandings(standingsData);
      setDivisions(divisionsData);
    } catch (error) {
      toast.error('Failed to load standings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const recalculateStandings = async (divisionId: string) => {
    try {
      const res = await fetch('/api/standings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisionId }),
      });

      if (!res.ok) throw new Error('Failed to recalculate');

      toast.success('Standings recalculated');
      fetchData();
    } catch (error) {
      toast.error('Failed to recalculate standings');
    }
  };

  const filteredStandings =
    selectedDivision === 'all'
      ? standings
      : standings.filter((s) => s.division.id === selectedDivision);

  // Group standings by division
  const standingsByDivision = filteredStandings.reduce((acc, standing) => {
    const divId = standing.division.id;
    if (!acc[divId]) {
      acc[divId] = {
        division: standing.division,
        standings: [],
      };
    }
    acc[divId].standings.push(standing);
    return acc;
  }, {} as Record<string, { division: Division; standings: Standing[] }>);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Standings</h1>
          <p className="text-muted mt-1">View league standings by division</p>
        </div>
      </div>

      {/* Division Filter */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-64">
            <Select
              label="Filter by Division"
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              options={[
                { value: 'all', label: 'All Divisions' },
                ...divisions.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.season.name})`,
                })),
              ]}
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading standings...</div>
      ) : Object.keys(standingsByDivision).length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">
              No standings data yet. Play some games to see standings!
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.values(standingsByDivision).map(({ division, standings: divStandings }) => (
            <Card key={division.id}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{division.name}</h2>
                  <p className="text-sm text-muted">{division.season.name}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => recalculateStandings(division.id)}
                >
                  Recalculate
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left rounded-tl-lg">Rank</th>
                      <th className="px-4 py-3 text-left">Team</th>
                      <th className="px-4 py-3 text-center">W</th>
                      <th className="px-4 py-3 text-center">L</th>
                      <th className="px-4 py-3 text-center">Win %</th>
                      <th className="px-4 py-3 text-center">PF</th>
                      <th className="px-4 py-3 text-center">PA</th>
                      <th className="px-4 py-3 text-center rounded-tr-lg">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divStandings
                      .sort((a, b) => {
                        // Sort by wins, then by point differential
                        if (b.wins !== a.wins) return b.wins - a.wins;
                        return b.pointDifferential - a.pointDifferential;
                      })
                      .map((standing, index) => (
                        <tr key={standing.id}>
                          <td className="px-4 py-3 border-b border-border">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                                index === 0
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : index === 1
                                  ? 'bg-gray-200 text-gray-700'
                                  : index === 2
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-border">
                            <div>
                              <p className="font-medium text-foreground">{standing.team.name}</p>
                              <p className="text-xs text-muted">
                                {standing.team.teamPlayers.length} players
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-b border-border text-center font-semibold text-success">
                            {standing.wins}
                          </td>
                          <td className="px-4 py-3 border-b border-border text-center font-semibold text-error">
                            {standing.losses}
                          </td>
                          <td className="px-4 py-3 border-b border-border text-center">
                            {standing.winPercentage.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 border-b border-border text-center">
                            {standing.pointsFor}
                          </td>
                          <td className="px-4 py-3 border-b border-border text-center">
                            {standing.pointsAgainst}
                          </td>
                          <td
                            className={`px-4 py-3 border-b border-border text-center font-semibold ${
                              standing.pointDifferential > 0
                                ? 'text-success'
                                : standing.pointDifferential < 0
                                ? 'text-error'
                                : 'text-muted'
                            }`}
                          >
                            {standing.pointDifferential > 0 ? '+' : ''}
                            {standing.pointDifferential}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
