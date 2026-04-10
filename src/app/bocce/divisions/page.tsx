'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface TimeSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Division {
  id: string;
  name: string;
  season: Season;
  teams: { id: string; name: string }[];
  playNights: { timeSlot: TimeSlot }[];
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [playNightModalOpen, setPlayNightModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [formData, setFormData] = useState({ name: '', seasonId: '' });
  const [seasonFormData, setSeasonFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: true,
  });
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState('');
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);

  const fetchData = async () => {
    try {
      const [divisionsRes, seasonsRes, timeSlotsRes] = await Promise.all([
        fetch('/api/divisions'),
        fetch('/api/seasons'),
        fetch('/api/timeslots'),
      ]);
      const [divisionsData, seasonsData, timeSlotsData] = await Promise.all([
        divisionsRes.json(),
        seasonsRes.json(),
        timeSlotsRes.json(),
      ]);
      setDivisions(divisionsData);
      setSeasons(seasonsData);
      setTimeSlots(timeSlotsData);
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
      const url = selectedDivision ? `/api/divisions/${selectedDivision.id}` : '/api/divisions';
      const method = selectedDivision ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save division');

      toast.success(selectedDivision ? 'Division updated!' : 'Division created!');
      setModalOpen(false);
      setSelectedDivision(null);
      setFormData({ name: '', seasonId: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save division');
    }
  };

  const handleSeasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingSeason ? `/api/seasons/${editingSeason.id}` : '/api/seasons';
      const method = editingSeason ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seasonFormData),
      });

      if (!res.ok) throw new Error('Failed to save season');

      toast.success(editingSeason ? 'Season updated!' : 'Season created!');
      closeSeasonModal();
      fetchData();
    } catch (error) {
      toast.error('Failed to save season');
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to delete this season? This will also delete all divisions and games in this season.')) return;

    try {
      const res = await fetch(`/api/seasons/${seasonId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete season');

      toast.success('Season deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete season');
    }
  };

  const openEditSeasonModal = (season: Season) => {
    setEditingSeason(season);
    setSeasonFormData({
      name: season.name,
      startDate: season.startDate.split('T')[0],
      endDate: season.endDate.split('T')[0],
      isActive: season.isActive,
    });
    setSeasonModalOpen(true);
  };

  const closeSeasonModal = () => {
    setSeasonModalOpen(false);
    setEditingSeason(null);
    setSeasonFormData({ name: '', startDate: '', endDate: '', isActive: true });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this division?')) return;

    try {
      const res = await fetch(`/api/divisions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete division');

      toast.success('Division deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete division');
    }
  };

  const handleAddPlayNight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivision || !selectedTimeSlotId) return;

    try {
      const res = await fetch(`/api/divisions/${selectedDivision.id}/playnights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlotId: selectedTimeSlotId }),
      });

      if (!res.ok) throw new Error('Failed to add play night');

      toast.success('Play night added');
      setPlayNightModalOpen(false);
      setSelectedTimeSlotId('');
      fetchData();
    } catch (error) {
      toast.error('Failed to add play night');
    }
  };

  const handleRemovePlayNight = async (divisionId: string, timeSlotId: string) => {
    try {
      const res = await fetch(`/api/divisions/${divisionId}/playnights?timeSlotId=${timeSlotId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove play night');

      toast.success('Play night removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove play night');
    }
  };

  const openEditModal = (division: Division) => {
    setSelectedDivision(division);
    setFormData({ name: division.name, seasonId: division.season.id });
    setModalOpen(true);
  };

  const openAddModal = () => {
    setSelectedDivision(null);
    setFormData({ name: '', seasonId: seasons[0]?.id || '' });
    setModalOpen(true);
  };

  const openPlayNightModal = (division: Division) => {
    setSelectedDivision(division);
    setSelectedTimeSlotId('');
    setPlayNightModalOpen(true);
  };

  const existingPlayNightIds = selectedDivision?.playNights.map((pn) => pn.timeSlot.id) || [];
  const availableTimeSlots = timeSlots.filter((ts) => !existingPlayNightIds.includes(ts.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Divisions</h1>
          <p className="text-muted mt-1">Manage league divisions and seasons</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setSeasonModalOpen(true)}>
            Create Season
          </Button>
          <Button onClick={openAddModal} disabled={seasons.length === 0}>
            Create Division
          </Button>
        </div>
      </div>

      {seasons.length === 0 && (
        <Card className="mb-6">
          <div className="text-center py-4">
            <p className="text-muted">Create a season first before adding divisions.</p>
          </div>
        </Card>
      )}

      {/* Seasons Overview */}
      {seasons.length > 0 && (
        <Card title="Seasons" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {seasons.map((season) => (
              <div
                key={season.id}
                className={`p-4 rounded-lg border-2 ${
                  season.isActive ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{season.name}</h4>
                    <p className="text-sm text-muted">
                      {new Date(season.startDate).toLocaleDateString()} -{' '}
                      {new Date(season.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  {season.isActive && (
                    <span className="px-2 py-1 bg-primary text-white text-xs font-medium rounded">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex space-x-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEditSeasonModal(season)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDeleteSeason(season.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted">Loading divisions...</div>
      ) : divisions.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No divisions yet. Create your first division!</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {divisions.map((division) => (
            <Card key={division.id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{division.name}</h3>
                  <p className="text-sm text-muted">{division.season.name}</p>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => openEditModal(division)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(division.id)}>
                    Delete
                  </Button>
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-muted">Teams</p>
                <p className="text-lg font-semibold text-foreground">{division.teams.length}</p>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-foreground">Play Nights</h4>
                  <Button size="sm" variant="outline" onClick={() => openPlayNightModal(division)}>
                    Add Night
                  </Button>
                </div>

                {division.playNights.length === 0 ? (
                  <p className="text-sm text-muted">No play nights configured</p>
                ) : (
                  <ul className="space-y-2">
                    {division.playNights.map((pn) => (
                      <li key={pn.timeSlot.id} className="flex justify-between items-center text-sm">
                        <span>
                          {dayNames[pn.timeSlot.dayOfWeek]} {pn.timeSlot.startTime} - {pn.timeSlot.endTime}
                        </span>
                        <button
                          onClick={() => handleRemovePlayNight(division.id, pn.timeSlot.id)}
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

      {/* Create/Edit Division Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedDivision ? 'Edit Division' : 'Create Division'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Division Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Division A, Gold Division"
            required
          />
          <Select
            label="Season"
            value={formData.seasonId}
            onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
            options={seasons.map((s) => ({ value: s.id, label: s.name }))}
            required
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {selectedDivision ? 'Update' : 'Create'} Division
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create/Edit Season Modal */}
      <Modal
        isOpen={seasonModalOpen}
        onClose={closeSeasonModal}
        title={editingSeason ? 'Edit Season' : 'Create Season'}
      >
        <form onSubmit={handleSeasonSubmit} className="space-y-4">
          <Input
            label="Season Name"
            value={seasonFormData.name}
            onChange={(e) => setSeasonFormData({ ...seasonFormData, name: e.target.value })}
            placeholder="e.g., Spring 2024, Fall 2024"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={seasonFormData.startDate}
              onChange={(e) => setSeasonFormData({ ...seasonFormData, startDate: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={seasonFormData.endDate}
              onChange={(e) => setSeasonFormData({ ...seasonFormData, endDate: e.target.value })}
              required
            />
          </div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={seasonFormData.isActive}
              onChange={(e) => setSeasonFormData({ ...seasonFormData, isActive: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">Set as active season</span>
          </label>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={closeSeasonModal}>
              Cancel
            </Button>
            <Button type="submit">{editingSeason ? 'Save Changes' : 'Create Season'}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Play Night Modal */}
      <Modal
        isOpen={playNightModalOpen}
        onClose={() => setPlayNightModalOpen(false)}
        title={`Add Play Night to ${selectedDivision?.name}`}
      >
        <form onSubmit={handleAddPlayNight} className="space-y-4">
          {availableTimeSlots.length === 0 ? (
            <p className="text-muted">
              No available time slots. Create time slots in the Schedule page first.
            </p>
          ) : (
            <Select
              label="Select Time Slot"
              value={selectedTimeSlotId}
              onChange={(e) => setSelectedTimeSlotId(e.target.value)}
              options={[
                { value: '', label: 'Select a time slot...' },
                ...availableTimeSlots.map((ts) => ({
                  value: ts.id,
                  label: `${dayNames[ts.dayOfWeek]} ${ts.startTime} - ${ts.endTime}`,
                })),
              ]}
              required
            />
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setPlayNightModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={availableTimeSlots.length === 0}>
              Add Play Night
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
