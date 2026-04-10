'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';

interface Room {
  id: string;
  name: string;
  capacity: number;
}

interface StaffRequest {
  id: string;
  requestType: string;
  description: string;
  status: string;
  requestedBy: string;
}

interface Meeting {
  id: string;
  title: string | null;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  roomCapacity: string;
  status: string;
  room: Room;
  staffRequests?: StaffRequest[];
}

interface RecurringSchedule {
  id: string;
  recurrenceType: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  weekOrdinal: number | null;
  startTime: string;
  endTime: string;
  roomCapacity: string;
  description: string | null;
  isActive: boolean;
  room: Room;
}

interface Group {
  id: string;
  name: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showStaffRequestModal, setShowStaffRequestModal] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [staffRequestForm, setStaffRequestForm] = useState({
    requestType: 'catering',
    description: '',
  });

  const [meetingForm, setMeetingForm] = useState({
    title: '',
    description: '',
    date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    startTime: '14:00',
    endTime: '16:00',
    roomId: '',
    roomCapacity: 'FULL',
  });

  const [recurringForm, setRecurringForm] = useState({
    recurrenceType: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    weekOrdinal: 1,
    startTime: '14:00',
    endTime: '16:00',
    roomId: '',
    roomCapacity: 'FULL',
    description: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
  });

  const fetchData = async () => {
    try {
      const [groupRes, meetingsRes, recurringRes, roomsRes] = await Promise.all([
        fetch(`/api/groups/${id}`),
        fetch(`/api/groups/${id}/meetings`),
        fetch(`/api/groups/${id}/recurring`),
        fetch('/api/rooms'),
      ]);

      if (!groupRes.ok) {
        router.push('/groups');
        return;
      }

      const [groupData, meetingsData, recurringData, roomsData] = await Promise.all([
        groupRes.json(),
        meetingsRes.json(),
        recurringRes.json(),
        roomsRes.json(),
      ]);

      setGroup(groupData);
      setMeetings(meetingsData);
      setRecurringSchedules(recurringData);
      setRooms(roomsData);

      if (roomsData.length > 0 && !meetingForm.roomId) {
        setMeetingForm((prev) => ({ ...prev, roomId: roomsData[0].id }));
        setRecurringForm((prev) => ({ ...prev, roomId: roomsData[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/groups/${id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create meeting');
      }

      toast.success('Meeting scheduled!');
      setShowMeetingModal(false);
      setMeetingForm({
        title: '',
        description: '',
        date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        startTime: '14:00',
        endTime: '16:00',
        roomId: rooms[0]?.id || '',
        roomCapacity: 'FULL',
      });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        roomId: recurringForm.roomId,
        recurrenceType: recurringForm.recurrenceType,
        startTime: recurringForm.startTime,
        endTime: recurringForm.endTime,
        roomCapacity: recurringForm.roomCapacity,
        description: recurringForm.description || null,
        startDate: recurringForm.startDate,
        endDate: recurringForm.endDate || null,
      };

      if (recurringForm.recurrenceType === 'weekly' || recurringForm.recurrenceType === 'biweekly') {
        payload.dayOfWeek = recurringForm.dayOfWeek;
      } else if (recurringForm.recurrenceType === 'monthly_day') {
        payload.dayOfMonth = recurringForm.dayOfMonth;
      } else if (recurringForm.recurrenceType === 'monthly_ordinal') {
        payload.weekOrdinal = recurringForm.weekOrdinal;
        payload.dayOfWeek = recurringForm.dayOfWeek;
      }

      const res = await fetch(`/api/groups/${id}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create schedule');
      }

      toast.success('Recurring schedule created!');
      setShowRecurringModal(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;

    try {
      const res = await fetch(`/api/groups/${id}/meetings/${meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!res.ok) throw new Error('Failed to cancel meeting');

      toast.success('Meeting cancelled');
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel meeting');
    }
  };

  const handleStaffRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId) return;

    setSubmitting(true);
    try {
      // Get the current member identity
      const saved = localStorage.getItem('groupsMemberIdentity');
      let requestedBy = 'Group Lead';
      if (saved) {
        try {
          const member = JSON.parse(saved);
          requestedBy = member.name;
        } catch {
          // ignore
        }
      }

      const res = await fetch(`/api/groups/${id}/meetings/${selectedMeetingId}/staff-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...staffRequestForm,
          requestedBy,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      toast.success('Staff request submitted! It will appear in the Staff Tasks app.');
      setShowStaffRequestModal(false);
      setSelectedMeetingId(null);
      setStaffRequestForm({ requestType: 'catering', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoomCapacityLabel = (capacity: string) => {
    const labels: Record<string, string> = {
      QUARTER: '1/4 Room',
      HALF: '1/2 Room',
      THREE_QUARTER: '3/4 Room',
      FULL: 'Full Room',
    };
    return labels[capacity] || capacity;
  };

  const getRecurrenceLabel = (schedule: RecurringSchedule) => {
    if (schedule.recurrenceType === 'weekly') {
      return `Weekly on ${DAYS_OF_WEEK[schedule.dayOfWeek!]}`;
    } else if (schedule.recurrenceType === 'biweekly') {
      return `Every 2 weeks on ${DAYS_OF_WEEK[schedule.dayOfWeek!]}`;
    } else if (schedule.recurrenceType === 'monthly_day') {
      return `Monthly on day ${schedule.dayOfMonth}`;
    } else if (schedule.recurrenceType === 'monthly_ordinal') {
      return `Monthly on ${ORDINALS[schedule.weekOrdinal! - 1]} ${DAYS_OF_WEEK[schedule.dayOfWeek!]}`;
    }
    return schedule.recurrenceType;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/groups/${id}`} className="text-indigo-600 hover:text-indigo-800 text-sm mb-4 inline-flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {group?.name}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Schedule Management</h1>
        <p className="text-gray-600 mt-1">Manage meetings and recurring schedules for {group?.name}</p>
      </div>

      <div className="space-y-6">
        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => setShowMeetingModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Schedule Meeting
          </button>
          <button
            onClick={() => setShowRecurringModal(true)}
            className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Create Recurring Schedule
          </button>
        </div>

        {/* Recurring Schedules */}
        <Card title="Recurring Schedules">
          {recurringSchedules.length > 0 ? (
            <div className="space-y-4">
              {recurringSchedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{getRecurrenceLabel(schedule)}</p>
                    <p className="text-sm text-gray-600">
                      {schedule.startTime} - {schedule.endTime} at {schedule.room.name}
                    </p>
                    <p className="text-xs text-gray-500">{getRoomCapacityLabel(schedule.roomCapacity)}</p>
                    {schedule.description && (
                      <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${schedule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {schedule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recurring schedules</p>
          )}
        </Card>

        {/* Upcoming Meetings */}
        <Card title="Upcoming Meetings">
          {meetings.length > 0 ? (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{meeting.title || 'Group Meeting'}</h4>
                    <p className="text-sm text-gray-600">
                      {format(new Date(meeting.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {meeting.startTime} - {meeting.endTime} at {meeting.room.name}
                    </p>
                    <p className="text-xs text-gray-400">{getRoomCapacityLabel(meeting.roomCapacity)}</p>
                    {meeting.description && (
                      <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setSelectedMeetingId(meeting.id);
                        setShowStaffRequestModal(true);
                      }}
                      className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded"
                    >
                      Request Staff
                    </button>
                    <button
                      onClick={() => handleCancelMeeting(meeting.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No upcoming meetings</p>
          )}
        </Card>
      </div>

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Meeting</h3>
            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional meeting title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={meetingForm.date}
                  onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={meetingForm.startTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={meetingForm.endTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room *</label>
                <select
                  value={meetingForm.roomId}
                  onChange={(e) => setMeetingForm({ ...meetingForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} (capacity: {room.capacity})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Capacity</label>
                <select
                  value={meetingForm.roomCapacity}
                  onChange={(e) => setMeetingForm({ ...meetingForm, roomCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="QUARTER">1/4 Room</option>
                  <option value="HALF">1/2 Room</option>
                  <option value="THREE_QUARTER">3/4 Room</option>
                  <option value="FULL">Full Room</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recurring Schedule Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Recurring Schedule</h3>
            <form onSubmit={handleCreateRecurring} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence Type *</label>
                <select
                  value={recurringForm.recurrenceType}
                  onChange={(e) => setRecurringForm({ ...recurringForm, recurrenceType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="monthly_day">Monthly (by day number)</option>
                  <option value="monthly_ordinal">Monthly (e.g., First Monday)</option>
                </select>
              </div>

              {(recurringForm.recurrenceType === 'weekly' || recurringForm.recurrenceType === 'biweekly' || recurringForm.recurrenceType === 'monthly_ordinal') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week *</label>
                  <select
                    value={recurringForm.dayOfWeek}
                    onChange={(e) => setRecurringForm({ ...recurringForm, dayOfWeek: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {DAYS_OF_WEEK.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {recurringForm.recurrenceType === 'monthly_day' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={recurringForm.dayOfMonth}
                    onChange={(e) => setRecurringForm({ ...recurringForm, dayOfMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {recurringForm.recurrenceType === 'monthly_ordinal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Week *</label>
                  <select
                    value={recurringForm.weekOrdinal}
                    onChange={(e) => setRecurringForm({ ...recurringForm, weekOrdinal: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {ORDINALS.map((ord, i) => (
                      <option key={i} value={i + 1}>{ord}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={recurringForm.startTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={recurringForm.endTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room *</label>
                <select
                  value={recurringForm.roomId}
                  onChange={(e) => setRecurringForm({ ...recurringForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} (capacity: {room.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Capacity</label>
                <select
                  value={recurringForm.roomCapacity}
                  onChange={(e) => setRecurringForm({ ...recurringForm, roomCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="QUARTER">1/4 Room</option>
                  <option value="HALF">1/2 Room</option>
                  <option value="THREE_QUARTER">3/4 Room</option>
                  <option value="FULL">Full Room</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={recurringForm.startDate}
                  onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                <input
                  type="date"
                  value={recurringForm.endDate}
                  onChange={(e) => setRecurringForm({ ...recurringForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={recurringForm.description}
                  onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRecurringModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Request Modal */}
      {showStaffRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Staff Support</h3>
            <p className="text-sm text-gray-600 mb-4">
              Submit a request for staff assistance with your meeting. This will create a task in the Staff Tasks app.
            </p>
            <form onSubmit={handleStaffRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type *</label>
                <select
                  value={staffRequestForm.requestType}
                  onChange={(e) => setStaffRequestForm({ ...staffRequestForm, requestType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="catering">Catering</option>
                  <option value="setup">Room Setup</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={staffRequestForm.description}
                  onChange={(e) => setStaffRequestForm({ ...staffRequestForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe what you need..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffRequestModal(false);
                    setSelectedMeetingId(null);
                    setStaffRequestForm({ requestType: 'catering', description: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !staffRequestForm.description.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
