'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Bracket from '@/components/Bracket';
import toast from 'react-hot-toast';

interface Court {
  id: string;
  name: string;
  location: string | null;
}

interface TimeSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  court: Court | null;
  isActive: boolean;
}

interface Division {
  id: string;
  name: string;
  season: { id: string; name: string };
  teams: { id: string; name: string }[];
}

interface Team {
  id: string;
  name: string;
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

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeSlotModalOpen, setTimeSlotModalOpen] = useState(false);
  const [courtModalOpen, setCourtModalOpen] = useState(false);
  const [autoScheduleModalOpen, setAutoScheduleModalOpen] = useState(false);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [timeSlotFormData, setTimeSlotFormData] = useState({
    dayOfWeek: '1',
    startTime: '18:00',
    endTime: '21:00',
    courtId: '',
  });
  const [courtFormData, setCourtFormData] = useState({
    name: '',
    location: '',
  });
  const [autoScheduleData, setAutoScheduleData] = useState({
    divisionId: '',
    startDate: '',
    doubleRoundRobin: false,
  });
  const [tournamentModalOpen, setTournamentModalOpen] = useState(false);
  const [tournamentData, setTournamentData] = useState({
    divisionIds: [] as string[],
    tournamentDate: '',
    timeSlotIds: [] as string[],
    format: 'pool_and_playoffs' as 'pool_and_playoffs' | 'single_elimination',
    teamsInPlayoffs: 4,
  });
  const [games, setGames] = useState<Game[]>([]);
  const [scheduleViewMode, setScheduleViewMode] = useState<'schedule' | 'bracket'>('schedule');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchData = async () => {
    try {
      const [timeSlotsRes, courtsRes, divisionsRes, gamesRes] = await Promise.all([
        fetch('/api/timeslots'),
        fetch('/api/courts'),
        fetch('/api/divisions'),
        fetch('/api/games'),
      ]);
      const [timeSlotsData, courtsData, divisionsData, gamesData] = await Promise.all([
        timeSlotsRes.json(),
        courtsRes.json(),
        divisionsRes.json(),
        gamesRes.json(),
      ]);
      setTimeSlots(timeSlotsData);
      setCourts(courtsData);
      setDivisions(divisionsData);
      setGames(gamesData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTimeSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingTimeSlot
        ? `/api/timeslots/${editingTimeSlot.id}`
        : '/api/timeslots';
      const method = editingTimeSlot ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: parseInt(timeSlotFormData.dayOfWeek),
          startTime: timeSlotFormData.startTime,
          endTime: timeSlotFormData.endTime,
          courtId: timeSlotFormData.courtId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save time slot');

      toast.success(editingTimeSlot ? 'Time slot updated!' : 'Time slot created!');
      closeTimeSlotModal();
      fetchData();
    } catch (error) {
      toast.error('Failed to save time slot');
    }
  };

  const handleCourtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingCourt
        ? `/api/courts/${editingCourt.id}`
        : '/api/courts';
      const method = editingCourt ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courtFormData),
      });

      if (!res.ok) throw new Error('Failed to save court');

      toast.success(editingCourt ? 'Court updated!' : 'Court created!');
      closeCourtModal();
      fetchData();
    } catch (error) {
      toast.error('Failed to save court');
    }
  };

  const openEditTimeSlot = (slot: TimeSlot) => {
    setEditingTimeSlot(slot);
    setTimeSlotFormData({
      dayOfWeek: slot.dayOfWeek.toString(),
      startTime: slot.startTime,
      endTime: slot.endTime,
      courtId: slot.court?.id || '',
    });
    setTimeSlotModalOpen(true);
  };

  const openEditCourt = (court: Court) => {
    setEditingCourt(court);
    setCourtFormData({
      name: court.name,
      location: court.location || '',
    });
    setCourtModalOpen(true);
  };

  const closeTimeSlotModal = () => {
    setTimeSlotModalOpen(false);
    setEditingTimeSlot(null);
    setTimeSlotFormData({ dayOfWeek: '1', startTime: '18:00', endTime: '21:00', courtId: '' });
  };

  const closeCourtModal = () => {
    setCourtModalOpen(false);
    setEditingCourt(null);
    setCourtFormData({ name: '', location: '' });
  };

  const handleAutoSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/schedule/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoScheduleData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to auto-schedule');
      }

      const result = await res.json();
      toast.success(result.message);
      setAutoScheduleModalOpen(false);
      setAutoScheduleData({ divisionId: '', startDate: '', doubleRoundRobin: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to auto-schedule');
    }
  };

  const handleTournamentSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tournamentData.divisionIds.length === 0) {
      toast.error('Please select at least one division');
      return;
    }

    if (tournamentData.timeSlotIds.length === 0) {
      toast.error('Please select at least one time slot');
      return;
    }

    try {
      const res = await fetch('/api/schedule/tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournamentData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create tournament');
      }

      const result = await res.json();
      toast.success(result.message);
      setTournamentModalOpen(false);
      setTournamentData({
        divisionIds: [],
        tournamentDate: '',
        timeSlotIds: [],
        format: 'pool_and_playoffs',
        teamsInPlayoffs: 4,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tournament');
    }
  };

  const toggleTournamentDivision = (divisionId: string) => {
    setTournamentData((prev) => ({
      ...prev,
      divisionIds: prev.divisionIds.includes(divisionId)
        ? prev.divisionIds.filter((id) => id !== divisionId)
        : [...prev.divisionIds, divisionId],
    }));
  };

  const toggleAllDivisions = () => {
    setTournamentData((prev) => ({
      ...prev,
      divisionIds: prev.divisionIds.length === divisions.length
        ? []
        : divisions.map((d) => d.id),
    }));
  };

  const toggleTournamentTimeSlot = (slotId: string) => {
    setTournamentData((prev) => ({
      ...prev,
      timeSlotIds: prev.timeSlotIds.includes(slotId)
        ? prev.timeSlotIds.filter((id) => id !== slotId)
        : [...prev.timeSlotIds, slotId],
    }));
  };

  const toggleAllTimeSlots = () => {
    setTournamentData((prev) => ({
      ...prev,
      timeSlotIds: prev.timeSlotIds.length === timeSlots.length
        ? []
        : timeSlots.map((ts) => ts.id),
    }));
  };

  const handleDeleteTimeSlot = async (id: string) => {
    if (!confirm('Delete this time slot?')) return;

    try {
      const res = await fetch(`/api/timeslots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Time slot deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete time slot');
    }
  };

  const handleDeleteCourt = async (id: string) => {
    if (!confirm('Delete this court?')) return;

    try {
      const res = await fetch(`/api/courts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Court deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete court');
    }
  };

  // Group time slots by day
  const slotsByDay = timeSlots.reduce((acc, slot) => {
    const day = slot.dayOfWeek;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {} as Record<number, TimeSlot[]>);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted mt-1">Manage courts, time slots, and auto-scheduling</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setCourtModalOpen(true)}>
            Add Court
          </Button>
          <Button variant="outline" onClick={() => setTimeSlotModalOpen(true)}>
            Add Time Slot
          </Button>
          <Button variant="outline" onClick={() => setAutoScheduleModalOpen(true)}>
            Auto-Schedule
          </Button>
          <Button onClick={() => setTournamentModalOpen(true)}>
            One-Day Tournament
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courts */}
          <Card title="Courts">
            {courts.length === 0 ? (
              <p className="text-muted text-center py-4">No courts configured</p>
            ) : (
              <ul className="space-y-3">
                {courts.map((court) => (
                  <li key={court.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{court.name}</p>
                      {court.location && <p className="text-sm text-muted">{court.location}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditCourt(court)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteCourt(court.id)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Time Slots */}
          <div className="lg:col-span-2">
            <Card title="Time Slots">
              {Object.keys(slotsByDay).length === 0 ? (
                <p className="text-muted text-center py-4">No time slots configured</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(slotsByDay)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([day, slots]) => (
                      <div key={day}>
                        <h4 className="font-semibold text-foreground mb-3">{dayNames[parseInt(day)]}</h4>
                        <div className="space-y-2">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {slot.startTime} - {slot.endTime}
                                </p>
                                {slot.court && (
                                  <p className="text-sm text-muted">{slot.court.name}</p>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditTimeSlot(slot)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleDeleteTimeSlot(slot.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Generated Schedule & Bracket View */}
      {games.length > 0 && (
        <div className="mt-8">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-foreground">Generated Games</h2>
              <div className="flex items-center gap-4">
                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted">Filter by date:</label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">All Dates</option>
                    {[...new Set(games.map(g => g.scheduledDate.split('T')[0]))].sort().map(date => (
                      <option key={date} value={date}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                {/* View Toggle */}
                <div className="flex border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setScheduleViewMode('schedule')}
                    className={`px-4 py-2 text-sm font-medium ${
                      scheduleViewMode === 'schedule'
                        ? 'bg-primary text-white'
                        : 'bg-white text-foreground hover:bg-gray-50'
                    }`}
                  >
                    Schedule
                  </button>
                  <button
                    onClick={() => setScheduleViewMode('bracket')}
                    className={`px-4 py-2 text-sm font-medium ${
                      scheduleViewMode === 'bracket'
                        ? 'bg-primary text-white'
                        : 'bg-white text-foreground hover:bg-gray-50'
                    }`}
                  >
                    Bracket
                  </button>
                </div>
              </div>
            </div>

            {scheduleViewMode === 'schedule' ? (
              <ScheduleListView
                games={games.filter(g => !selectedDate || g.scheduledDate.startsWith(selectedDate))}
              />
            ) : (
              <BracketView
                games={games.filter(g => g.isPlayoff && (!selectedDate || g.scheduledDate.startsWith(selectedDate)))}
              />
            )}
          </Card>
        </div>
      )}

      {/* Time Slot Modal */}
      <Modal
        isOpen={timeSlotModalOpen}
        onClose={closeTimeSlotModal}
        title={editingTimeSlot ? 'Edit Time Slot' : 'Add Time Slot'}
      >
        <form onSubmit={handleTimeSlotSubmit} className="space-y-4">
          <Select
            label="Day of Week"
            value={timeSlotFormData.dayOfWeek}
            onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, dayOfWeek: e.target.value })}
            options={dayNames.map((day, i) => ({ value: i.toString(), label: day }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={timeSlotFormData.startTime}
              onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, startTime: e.target.value })}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={timeSlotFormData.endTime}
              onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, endTime: e.target.value })}
              required
            />
          </div>
          <Select
            label="Court (Optional)"
            value={timeSlotFormData.courtId}
            onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, courtId: e.target.value })}
            options={[
              { value: '', label: 'No specific court' },
              ...courts.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={closeTimeSlotModal}>
              Cancel
            </Button>
            <Button type="submit">{editingTimeSlot ? 'Save Changes' : 'Add Time Slot'}</Button>
          </div>
        </form>
      </Modal>

      {/* Court Modal */}
      <Modal
        isOpen={courtModalOpen}
        onClose={closeCourtModal}
        title={editingCourt ? 'Edit Court' : 'Add Court'}
      >
        <form onSubmit={handleCourtSubmit} className="space-y-4">
          <Input
            label="Court Name"
            value={courtFormData.name}
            onChange={(e) => setCourtFormData({ ...courtFormData, name: e.target.value })}
            placeholder="e.g., Court 1, Lane A"
            required
          />
          <Input
            label="Location (Optional)"
            value={courtFormData.location}
            onChange={(e) => setCourtFormData({ ...courtFormData, location: e.target.value })}
            placeholder="e.g., North side"
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={closeCourtModal}>
              Cancel
            </Button>
            <Button type="submit">{editingCourt ? 'Save Changes' : 'Add Court'}</Button>
          </div>
        </form>
      </Modal>

      {/* Auto-Schedule Modal */}
      <Modal
        isOpen={autoScheduleModalOpen}
        onClose={() => setAutoScheduleModalOpen(false)}
        title="Auto-Schedule Division"
      >
        <form onSubmit={handleAutoSchedule} className="space-y-4">
          <p className="text-sm text-muted">
            This will automatically generate a round-robin schedule where every team plays every
            other team. Make sure you have configured play nights for the division.
          </p>
          <Select
            label="Division"
            value={autoScheduleData.divisionId}
            onChange={(e) => setAutoScheduleData({ ...autoScheduleData, divisionId: e.target.value })}
            options={[
              { value: '', label: 'Select a division...' },
              ...divisions.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.teams.length} teams)`,
              })),
            ]}
            required
          />
          <Input
            label="Start Date"
            type="date"
            value={autoScheduleData.startDate}
            onChange={(e) => setAutoScheduleData({ ...autoScheduleData, startDate: e.target.value })}
            required
          />
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoScheduleData.doubleRoundRobin}
              onChange={(e) =>
                setAutoScheduleData({ ...autoScheduleData, doubleRoundRobin: e.target.checked })
              }
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              Double round-robin (each team plays every other team twice)
            </span>
          </label>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setAutoScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Generate Schedule</Button>
          </div>
        </form>
      </Modal>

      {/* One-Day Tournament Modal */}
      <Modal
        isOpen={tournamentModalOpen}
        onClose={() => setTournamentModalOpen(false)}
        title="Create One-Day Tournament"
        size="lg"
      >
        <form onSubmit={handleTournamentSchedule} className="space-y-4">
          <p className="text-sm text-muted">
            Create a tournament for a single day. Games will be assigned to time slots in order.
          </p>

          <Input
            label="Tournament Date"
            type="date"
            value={tournamentData.tournamentDate}
            onChange={(e) => setTournamentData({ ...tournamentData, tournamentDate: e.target.value })}
            required
          />

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-foreground">
                Divisions
              </label>
              <button
                type="button"
                onClick={toggleAllDivisions}
                className="text-sm text-primary hover:underline"
              >
                {tournamentData.divisionIds.length === divisions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {divisions.length === 0 ? (
                <p className="text-sm text-muted">No divisions configured.</p>
              ) : (
                divisions.map((division) => (
                  <label
                    key={division.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={tournamentData.divisionIds.includes(division.id)}
                      onChange={() => toggleTournamentDivision(division.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-foreground">
                      {division.name}
                      <span className="text-muted ml-2">({division.teams.length} teams)</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-foreground">
                Time Slots
              </label>
              <button
                type="button"
                onClick={toggleAllTimeSlots}
                className="text-sm text-primary hover:underline"
              >
                {tournamentData.timeSlotIds.length === timeSlots.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {timeSlots.length === 0 ? (
                <p className="text-sm text-muted">
                  No time slots configured. Add time slots first.
                </p>
              ) : (
                timeSlots.map((slot) => (
                  <label
                    key={slot.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={tournamentData.timeSlotIds.includes(slot.id)}
                      onChange={() => toggleTournamentTimeSlot(slot.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-foreground">
                      {slot.startTime} - {slot.endTime}
                      {slot.court && <span className="text-muted ml-2">({slot.court.name})</span>}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-foreground mb-3">
              Tournament Format
            </label>
            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="radio"
                  name="format"
                  checked={tournamentData.format === 'pool_and_playoffs'}
                  onChange={() => setTournamentData({ ...tournamentData, format: 'pool_and_playoffs' })}
                  className="mt-1 border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-foreground font-medium">Pool Play + Playoffs</span>
                  <p className="text-sm text-muted">Round-robin pool play, then top teams advance to bracket</p>
                </div>
              </label>
              <label className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="radio"
                  name="format"
                  checked={tournamentData.format === 'single_elimination'}
                  onChange={() => setTournamentData({ ...tournamentData, format: 'single_elimination' })}
                  className="mt-1 border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-foreground font-medium">Single Elimination</span>
                  <p className="text-sm text-muted">All teams in one bracket, lose and you&apos;re out</p>
                </div>
              </label>
            </div>

            {tournamentData.format === 'pool_and_playoffs' && (
              <div className="mt-4 pl-6">
                <Select
                  label="Teams in Playoffs"
                  value={tournamentData.teamsInPlayoffs.toString()}
                  onChange={(e) =>
                    setTournamentData({
                      ...tournamentData,
                      teamsInPlayoffs: parseInt(e.target.value),
                    })
                  }
                  options={[
                    { value: '2', label: '2 teams (Finals only)' },
                    { value: '4', label: '4 teams (Semi-finals + Finals)' },
                    { value: '8', label: '8 teams (Quarter-finals through Finals)' },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setTournamentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={timeSlots.length === 0 || divisions.length === 0}>
              Create Tournament
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Schedule List View Component
function ScheduleListView({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        No games found for the selected date.
      </div>
    );
  }

  // Group games by date and time
  const gamesByDateAndTime = games.reduce((acc, game) => {
    const date = game.scheduledDate.split('T')[0];
    const time = game.timeSlot?.startTime || 'TBD';
    const key = `${date}-${time}`;
    if (!acc[key]) {
      acc[key] = { date, time, games: [] };
    }
    acc[key].games.push(game);
    return acc;
  }, {} as Record<string, { date: string; time: string; games: Game[] }>);

  const sortedGroups = Object.values(gamesByDateAndTime).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  return (
    <div className="space-y-6">
      {sortedGroups.map((group) => (
        <div key={`${group.date}-${group.time}`}>
          <div className="flex items-center gap-4 mb-3">
            <h3 className="font-semibold text-foreground">
              {new Date(group.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <span className="px-2 py-1 bg-primary text-white text-sm rounded">
              {group.time}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.games.map((game) => (
              <div
                key={game.id}
                className={`p-4 rounded-lg border ${
                  game.isPlayoff
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-border bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 bg-secondary text-primary rounded">
                    {game.court?.name || 'No Court'}
                  </span>
                  {game.isPlayoff && (
                    <span className="text-xs font-bold text-yellow-600">
                      {game.playoffRound === 1 ? 'Round 1' :
                       game.playoffRound === 2 ? 'Semi-Final' :
                       game.playoffRound === 3 ? 'Final' :
                       `Round ${game.playoffRound}`}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${
                      game.status === 'completed' && game.homeScore !== null && game.awayScore !== null &&
                      game.homeScore > game.awayScore ? 'text-green-600' : 'text-foreground'
                    }`}>
                      {game.homeTeam?.name || 'TBD'}
                    </span>
                    {game.status === 'completed' && game.homeScore !== null && (
                      <span className="font-bold">{game.homeScore}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${
                      game.status === 'completed' && game.homeScore !== null && game.awayScore !== null &&
                      game.awayScore > game.homeScore ? 'text-green-600' : 'text-foreground'
                    }`}>
                      {game.awayTeam?.name || 'TBD'}
                    </span>
                    {game.status === 'completed' && game.awayScore !== null && (
                      <span className="font-bold">{game.awayScore}</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted">
                  {game.status === 'scheduled' && 'Scheduled'}
                  {game.status === 'in_progress' && (
                    <span className="text-yellow-600 font-semibold">In Progress</span>
                  )}
                  {game.status === 'completed' && (
                    <span className="text-green-600">Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Bracket View Component (wrapper)
function BracketView({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        No playoff bracket available. Generate a tournament with playoffs first.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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
        showControls={false}
      />
    </div>
  );
}
