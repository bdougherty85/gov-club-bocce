'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import toast from 'react-hot-toast';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  teamPlayers: {
    team: {
      name: string;
      division: { name: string };
    };
  }[];
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      toast.error('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingPlayer ? `/api/players/${editingPlayer.id}` : '/api/players';
      const method = editingPlayer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save player');

      toast.success(editingPlayer ? 'Player updated!' : 'Player added!');
      setModalOpen(false);
      setEditingPlayer(null);
      setFormData({ firstName: '', lastName: '', email: '', phone: '' });
      fetchPlayers();
    } catch (error) {
      toast.error('Failed to save player');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
      const res = await fetch(`/api/players/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete player');

      toast.success('Player deleted');
      fetchPlayers();
    } catch (error) {
      toast.error('Failed to delete player');
    }
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setFormData({
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email || '',
      phone: player.phone || '',
    });
    setModalOpen(true);
  };

  const openAddModal = () => {
    setEditingPlayer(null);
    setFormData({ firstName: '', lastName: '', email: '', phone: '' });
    setModalOpen(true);
  };

  const filteredPlayers = players.filter(
    (p) =>
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (player: Player) => (
        <span className="font-medium">{player.firstName} {player.lastName}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (player: Player) => player.email || '-',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (player: Player) => player.phone || '-',
    },
    {
      key: 'team',
      header: 'Team',
      render: (player: Player) =>
        player.teamPlayers.length > 0
          ? player.teamPlayers.map((tp) => tp.team.name).join(', ')
          : '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (player: Player) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${
            player.isActive
              ? 'bg-success/10 text-success'
              : 'bg-error/10 text-error'
          }`}
        >
          {player.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (player: Player) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="ghost" onClick={() => openEditModal(player)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(player.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Players</h1>
          <p className="text-muted mt-1">Manage league players</p>
        </div>
        <Button onClick={openAddModal}>Add Player</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted">Loading players...</div>
        ) : (
          <Table
            columns={columns}
            data={filteredPlayers}
            keyExtractor={(p) => p.id}
            emptyMessage="No players found. Add your first player!"
          />
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlayer ? 'Edit Player' : 'Add Player'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingPlayer ? 'Update' : 'Add'} Player
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
