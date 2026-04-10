'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

interface WeekInfo {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  isAvailable: boolean;
  notes: string;
}

interface Availability {
  id: string;
  weekNumber: number;
  isAvailable: boolean;
  notes: string | null;
}

export default function AvailabilityPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playersRes, seasonsRes] = await Promise.all([
          fetch('/api/players'),
          fetch('/api/seasons'),
        ]);
        const [playersData, seasonsData] = await Promise.all([
          playersRes.json(),
          seasonsRes.json(),
        ]);

        setPlayers(playersData);
        setSeasons(seasonsData);

        // Auto-select active season
        const activeSeason = seasonsData.find((s: Season) => s.isActive);
        if (activeSeason) {
          setSelectedSeason(activeSeason.id);
        }

        // Check for saved player identity
        const savedPlayer = localStorage.getItem('playerIdentity');
        if (savedPlayer) {
          setSelectedPlayer(savedPlayer);
        }
      } catch (error) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generate weeks for the season and fetch availability
  useEffect(() => {
    if (!selectedSeason || !selectedPlayer) {
      setWeeks([]);
      return;
    }

    const generateWeeksAndFetchAvailability = async () => {
      const season = seasons.find((s) => s.id === selectedSeason);
      if (!season) return;

      // Generate weeks from season start to end
      const startDate = new Date(season.startDate);
      const endDate = new Date(season.endDate);
      const generatedWeeks: WeekInfo[] = [];

      let weekNumber = 1;
      const currentWeekStart = new Date(startDate);
      // Align to Monday
      const dayOfWeek = currentWeekStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
      currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);

      while (currentWeekStart <= endDate) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        generatedWeeks.push({
          weekNumber,
          weekStart: new Date(currentWeekStart),
          weekEnd: new Date(weekEnd),
          isAvailable: true, // Default to available
          notes: '',
        });

        weekNumber++;
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      }

      // Fetch existing availability
      try {
        const res = await fetch(
          `/api/players/${selectedPlayer}/availability?seasonId=${selectedSeason}`
        );
        const availability: Availability[] = await res.json();

        // Merge availability with generated weeks
        const mergedWeeks = generatedWeeks.map((week) => {
          const existing = availability.find((a) => a.weekNumber === week.weekNumber);
          if (existing) {
            return {
              ...week,
              isAvailable: existing.isAvailable,
              notes: existing.notes || '',
            };
          }
          return week;
        });

        setWeeks(mergedWeeks);
      } catch (error) {
        setWeeks(generatedWeeks);
      }
    };

    generateWeeksAndFetchAvailability();
  }, [selectedSeason, selectedPlayer, seasons]);

  const handlePlayerChange = (playerId: string) => {
    setSelectedPlayer(playerId);
    if (playerId) {
      localStorage.setItem('playerIdentity', playerId);
    }
  };

  const toggleAvailability = (weekNumber: number) => {
    setWeeks((prev) =>
      prev.map((week) =>
        week.weekNumber === weekNumber
          ? { ...week, isAvailable: !week.isAvailable }
          : week
      )
    );
  };

  const updateNotes = (weekNumber: number, notes: string) => {
    setWeeks((prev) =>
      prev.map((week) =>
        week.weekNumber === weekNumber ? { ...week, notes } : week
      )
    );
  };

  const saveAvailability = async () => {
    if (!selectedPlayer || !selectedSeason) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/players/${selectedPlayer}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeason,
          weeks: weeks.map((w) => ({
            weekNumber: w.weekNumber,
            isAvailable: w.isAvailable,
            notes: w.notes || null,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('Availability saved!');
    } catch (error) {
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const markAllAvailable = () => {
    setWeeks((prev) => prev.map((week) => ({ ...week, isAvailable: true })));
  };

  const markAllUnavailable = () => {
    setWeeks((prev) => prev.map((week) => ({ ...week, isAvailable: false })));
  };

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">My Availability</h1>
        <p className="text-muted mt-1">
          Set which weeks you are available to play this season
        </p>
      </div>

      {/* Player & Season Selection */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Select
              label="Select Yourself"
              value={selectedPlayer}
              onChange={(e) => handlePlayerChange(e.target.value)}
              options={[
                { value: '', label: 'Choose your name...' },
                ...players.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}`,
                })),
              ]}
            />
          </div>
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
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading...</div>
      ) : !selectedPlayer ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">Please select your name to set availability.</p>
          </div>
        </Card>
      ) : !selectedSeason ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">Please select a season.</p>
          </div>
        </Card>
      ) : weeks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No weeks found for this season.</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={markAllAvailable}>
                Mark All Available
              </Button>
              <Button size="sm" variant="outline" onClick={markAllUnavailable}>
                Mark All Unavailable
              </Button>
            </div>
            <Button onClick={saveAvailability} disabled={saving}>
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>
          </div>

          {/* Availability Grid */}
          <Card>
            <div className="space-y-2">
              {weeks.map((week) => (
                <div
                  key={week.weekNumber}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    week.isAvailable
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleAvailability(week.weekNumber)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${
                        week.isAvailable
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {week.weekNumber}
                    </button>
                    <div>
                      <p className="font-medium text-foreground">
                        Week {week.weekNumber}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDateRange(week.weekStart, week.weekEnd)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      placeholder={week.isAvailable ? '' : 'Reason (optional)'}
                      value={week.notes}
                      onChange={(e) => updateNotes(week.weekNumber, e.target.value)}
                      className="w-48 px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => toggleAvailability(week.weekNumber)}
                      className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                        week.isAvailable
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {week.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Save Button (bottom) */}
          <div className="mt-6 flex justify-end">
            <Button onClick={saveAvailability} disabled={saving}>
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
