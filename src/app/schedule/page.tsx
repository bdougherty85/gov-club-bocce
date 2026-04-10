'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
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

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeSlotModalOpen, setTimeSlotModalOpen] = useState(false);
  const [courtModalOpen, setCourtModalOpen] = useState(false);
  const [autoScheduleModalOpen, setAutoScheduleModalOpen] = useState(false);
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

  const fetchData = async () => {
    try {
      const [timeSlotsRes, courtsRes, divisionsRes] = await Promise.all([
        fetch('/api/timeslots'),
        fetch('/api/courts'),
        fetch('/api/divisions'),
      ]);
      const [timeSlotsData, courtsData, divisionsData] = await Promise.all([
        timeSlotsRes.json(),
        courtsRes.json(),
        divisionsRes.json(),
      ]);
      setTimeSlots(timeSlotsData);
      setCourts(courtsData);
      setDivisions(divisionsData);
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
      const res = await fetch('/api/timeslots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: parseInt(timeSlotFormData.dayOfWeek),
          startTime: timeSlotFormData.startTime,
          endTime: timeSlotFormData.endTime,
          courtId: timeSlotFormData.courtId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create time slot');

      toast.success('Time slot created!');
      setTimeSlotModalOpen(false);
      setTimeSlotFormData({ dayOfWeek: '1', startTime: '18:00', endTime: '21:00', courtId: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create time slot');
    }
  };

  const handleCourtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/courts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courtFormData),
      });

      if (!res.ok) throw new Error('Failed to create court');

      toast.success('Court created!');
      setCourtModalOpen(false);
      setCourtFormData({ name: '', location: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create court');
    }
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
          <Button onClick={() => setAutoScheduleModalOpen(true)}>
            Auto-Schedule
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
                    <Button size="sm" variant="danger" onClick={() => handleDeleteCourt(court.id)}>
                      Delete
                    </Button>
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
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeleteTimeSlot(slot.id)}
                              >
                                Delete
                              </Button>
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

      {/* Add Time Slot Modal */}
      <Modal
        isOpen={timeSlotModalOpen}
        onClose={() => setTimeSlotModalOpen(false)}
        title="Add Time Slot"
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
            <Button type="button" variant="outline" onClick={() => setTimeSlotModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Time Slot</Button>
          </div>
        </form>
      </Modal>

      {/* Add Court Modal */}
      <Modal
        isOpen={courtModalOpen}
        onClose={() => setCourtModalOpen(false)}
        title="Add Court"
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
            <Button type="button" variant="outline" onClick={() => setCourtModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Court</Button>
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
    </div>
  );
}
