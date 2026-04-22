'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface Division {
  id: string;
  name: string;
  season: { name: string };
}

interface Team {
  id: string;
  name: string;
  division: Division;
  teamPlayers: {
    player: Player;
    isCaptain: boolean;
  }[];
  standings: {
    wins: number;
    losses: number;
  }[];
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    divisionId: '',
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const fetchData = async () => {
    try {
      const [teamsRes, divisionsRes, playersRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/divisions'),
        fetch('/api/players'),
      ]);
      const [teamsData, divisionsData, playersData] = await Promise.all([
        teamsRes.json(),
        divisionsRes.json(),
        playersRes.json(),
      ]);
      setTeams(teamsData);
      setDivisions(divisionsData);
      setPlayers(playersData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = selectedTeam ? `/api/teams/${selectedTeam.id}` : '/api/teams';
      const method = selectedTeam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save team');

      toast.success(selectedTeam ? 'Team updated!' : 'Team created!');
      setModalOpen(false);
      setSelectedTeam(null);
      setFormData({ name: '', divisionId: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save team');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete team');

      toast.success('Team deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete team');
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !selectedPlayerId) return;

    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: selectedPlayerId }),
      });

      if (!res.ok) throw new Error('Failed to add player');

      toast.success('Player added to team');
      setPlayerModalOpen(false);
      setSelectedPlayerId('');
      fetchData();
    } catch (error) {
      toast.error('Failed to add player');
    }
  };

  const handleRemovePlayer = async (teamId: string, playerId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/players?playerId=${playerId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove player');

      toast.success('Player removed from team');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove player');
    }
  };

  const handleGenerateFunNames = async () => {
    if (!confirm('Generate fun team names based on player last names? This will rename all teams.')) return;

    try {
      const res = await fetch('/api/teams/generate-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to generate names');

      const result = await res.json();
      toast.success(result.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to generate team names');
    }
  };

  const handleResetNames = async () => {
    if (!confirm('Reset all team names to "Team 1, Team 2, etc."?')) return;

    try {
      const res = await fetch('/api/teams/generate-names', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Failed to reset names');

      const result = await res.json();
      toast.success(result.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to reset team names');
    }
  };

  const openEditModal = (team: Team) => {
    setSelectedTeam(team);
    setFormData({ name: team.name, divisionId: team.division.id });
    setModalOpen(true);
  };

  const openAddModal = () => {
    setSelectedTeam(null);
    setFormData({ name: '', divisionId: divisions[0]?.id || '' });
    setModalOpen(true);
  };

  const openPlayerModal = (team: Team) => {
    setSelectedTeam(team);
    setSelectedPlayerId('');
    setPlayerModalOpen(true);
  };

  const teamPlayerIds = selectedTeam?.teamPlayers.map((tp) => tp.player.id) || [];
  const availablePlayers = players.filter((p) => !teamPlayerIds.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Teams</h1>
          <p className="text-muted mt-1">Manage league teams and rosters</p>
        </div>
        <div className="flex space-x-3">
          {teams.length > 0 && (
            <>
              <Button variant="outline" onClick={handleGenerateFunNames}>
                Generate Fun Names
              </Button>
              <Button variant="outline" onClick={handleResetNames}>
                Reset Names
              </Button>
            </>
          )}
          <Button onClick={openAddModal} disabled={divisions.length === 0}>
            Create Team
          </Button>
        </div>
      </div>

      {divisions.length === 0 && (
        <Card className="mb-6">
          <div className="text-center py-4">
            <p className="text-muted">Create a division first before adding teams.</p>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted">Loading teams...</div>
      ) : teams.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No teams yet. Create your first team!</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card key={team.id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{team.name}</h3>
                  <p className="text-sm text-muted">{team.division.name}</p>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => openEditModal(team)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(team.id)}>
                    Delete
                  </Button>
                </div>
              </div>

              {team.standings[0] && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-muted">Record</p>
                  <p className="text-lg font-semibold text-foreground">
                    {team.standings[0].wins}W - {team.standings[0].losses}L
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-foreground">Roster ({team.teamPlayers.length})</h4>
                  <Button size="sm" variant="outline" onClick={() => openPlayerModal(team)}>
                    Add Player
                  </Button>
                </div>

                {team.teamPlayers.length === 0 ? (
                  <p className="text-sm text-muted">No players on roster</p>
                ) : (
                  <ul className="space-y-2">
                    {team.teamPlayers.map((tp) => (
                      <li key={tp.player.id} className="flex justify-between items-center text-sm">
                        <span>
                          {tp.player.firstName} {tp.player.lastName}
                          {tp.isCaptain && (
                            <span className="ml-2 px-1.5 py-0.5 bg-secondary/10 text-secondary text-xs rounded">
                              Captain
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleRemovePlayer(team.id, tp.player.id)}
                          className="text-error hover:underline text-xs"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Team Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTeam ? 'Edit Team' : 'Create Team'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Team Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Select
            label="Division"
            value={formData.divisionId}
            onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })}
            options={divisions.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.season.name})`,
            }))}
            required
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {selectedTeam ? 'Update' : 'Create'} Team
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Player Modal */}
      <Modal
        isOpen={playerModalOpen}
        onClose={() => setPlayerModalOpen(false)}
        title={`Add Player to ${selectedTeam?.name}`}
      >
        <form onSubmit={handleAddPlayer} className="space-y-4">
          {availablePlayers.length === 0 ? (
            <p className="text-muted">No available players. All players are already on this team.</p>
          ) : (
            <Select
              label="Select Player"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              options={[
                { value: '', label: 'Select a player...' },
                ...availablePlayers.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}`,
                })),
              ]}
              required
            />
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setPlayerModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={availablePlayers.length === 0}>
              Add Player
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
