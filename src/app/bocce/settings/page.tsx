'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

interface Settings {
  id: string;
  leagueName: string;
  playoffFormat: string;
  teamsInPlayoffs: number;
  gamesPerMatch: number;
  pointsToWin: number;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
}

interface OffWeek {
  id: string;
  weekStart: string;
  reason: string | null;
}

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  offWeeks: OffWeek[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);
  const [addingOffWeek, setAddingOffWeek] = useState(false);
  const [newOffWeek, setNewOffWeek] = useState({ weekStart: '', reason: '' });
  const [formData, setFormData] = useState({
    leagueName: '',
    playoffFormat: 'single',
    teamsInPlayoffs: 8,
    gamesPerMatch: 3,
    pointsToWin: 12,
    primaryColor: '#1B4D3E',
    secondaryColor: '#C5A572',
  });
  const [seasonFormData, setSeasonFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
      setFormData({
        leagueName: data.leagueName,
        playoffFormat: data.playoffFormat,
        teamsInPlayoffs: data.teamsInPlayoffs,
        gamesPerMatch: data.gamesPerMatch,
        pointsToWin: data.pointsToWin,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async () => {
    try {
      const res = await fetch('/api/seasons');
      const data = await res.json();
      setSeasons(data);
      // Select active season by default
      const activeSeason = data.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason);
        setSeasonFormData({
          name: activeSeason.name,
          startDate: activeSeason.startDate.split('T')[0],
          endDate: activeSeason.endDate.split('T')[0],
          isActive: activeSeason.isActive,
        });
      }
    } catch (error) {
      console.error('Failed to load seasons:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSeasons();
  }, []);

  const handleSeasonSelect = (seasonId: string) => {
    const season = seasons.find((s) => s.id === seasonId);
    if (season) {
      setSelectedSeason(season);
      setSeasonFormData({
        name: season.name,
        startDate: season.startDate.split('T')[0],
        endDate: season.endDate.split('T')[0],
        isActive: season.isActive,
      });
    }
  };

  const handleSeasonSave = async () => {
    if (!selectedSeason) return;
    setSavingSeason(true);

    try {
      const res = await fetch(`/api/seasons/${selectedSeason.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seasonFormData),
      });

      if (!res.ok) throw new Error('Failed to save season');

      toast.success('Season updated!');
      fetchSeasons();
    } catch (error) {
      toast.error('Failed to save season');
    } finally {
      setSavingSeason(false);
    }
  };

  const handleAddOffWeek = async () => {
    if (!selectedSeason || !newOffWeek.weekStart) return;
    setAddingOffWeek(true);

    try {
      const res = await fetch(`/api/seasons/${selectedSeason.id}/off-weeks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOffWeek),
      });

      if (!res.ok) throw new Error('Failed to add off week');

      toast.success('Off week added!');
      setNewOffWeek({ weekStart: '', reason: '' });
      fetchSeasons();
    } catch (error) {
      toast.error('Failed to add off week');
    } finally {
      setAddingOffWeek(false);
    }
  };

  const handleDeleteOffWeek = async (offWeekId: string) => {
    if (!selectedSeason) return;

    try {
      const res = await fetch(
        `/api/seasons/${selectedSeason.id}/off-weeks?offWeekId=${offWeekId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('Failed to delete off week');

      toast.success('Off week removed!');
      fetchSeasons();
    } catch (error) {
      toast.error('Failed to delete off week');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      toast.success('Settings saved!');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 text-muted">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted mt-1">Configure league settings and preferences</p>
      </div>

      {/* Season Management */}
      <Card title="Season Management">
        <div className="space-y-6">
          {/* Season Selector */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Select
                label="Select Season"
                value={selectedSeason?.id || ''}
                onChange={(e) => handleSeasonSelect(e.target.value)}
                options={seasons.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.isActive ? ' (Active)' : ''}`,
                }))}
              />
            </div>
          </div>

          {selectedSeason && (
            <>
              {/* Season Details */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Season Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Season Name"
                    value={seasonFormData.name}
                    onChange={(e) =>
                      setSeasonFormData({ ...seasonFormData, name: e.target.value })
                    }
                    placeholder="e.g., Spring 2024"
                  />
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={seasonFormData.isActive}
                      onChange={(e) =>
                        setSeasonFormData({ ...seasonFormData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-border"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                      Active Season
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <Input
                    label="Start Date"
                    type="date"
                    value={seasonFormData.startDate}
                    onChange={(e) =>
                      setSeasonFormData({ ...seasonFormData, startDate: e.target.value })
                    }
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={seasonFormData.endDate}
                    onChange={(e) =>
                      setSeasonFormData({ ...seasonFormData, endDate: e.target.value })
                    }
                  />
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={handleSeasonSave}
                    disabled={savingSeason}
                    variant="secondary"
                  >
                    {savingSeason ? 'Saving...' : 'Save Season'}
                  </Button>
                </div>
              </div>

              {/* Off Weeks */}
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">
                  Off Weeks / Bye Weeks
                </h4>
                <p className="text-sm text-muted mb-4">
                  Specify weeks when the league will not play (holidays, venue closures, etc.)
                </p>

                {/* Add Off Week Form */}
                <div className="flex flex-wrap items-end gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-[150px]">
                    <Input
                      label="Week Start Date"
                      type="date"
                      value={newOffWeek.weekStart}
                      onChange={(e) =>
                        setNewOffWeek({ ...newOffWeek, weekStart: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <Input
                      label="Reason (optional)"
                      value={newOffWeek.reason}
                      onChange={(e) =>
                        setNewOffWeek({ ...newOffWeek, reason: e.target.value })
                      }
                      placeholder="e.g., Thanksgiving"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddOffWeek}
                    disabled={addingOffWeek || !newOffWeek.weekStart}
                    variant="secondary"
                  >
                    {addingOffWeek ? 'Adding...' : 'Add Off Week'}
                  </Button>
                </div>

                {/* Off Weeks List */}
                {selectedSeason.offWeeks?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSeason.offWeeks.map((offWeek) => (
                      <div
                        key={offWeek.id}
                        className="flex items-center justify-between p-3 bg-white border border-border rounded-lg"
                      >
                        <div>
                          <span className="font-medium">
                            {new Date(offWeek.weekStart).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {offWeek.reason && (
                            <span className="ml-2 text-muted">— {offWeek.reason}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteOffWeek(offWeek.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove off week"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted italic">No off weeks scheduled.</p>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Settings */}
        <Card title="General Settings">
          <div className="space-y-4">
            <Input
              label="League Name"
              value={formData.leagueName}
              onChange={(e) => setFormData({ ...formData, leagueName: e.target.value })}
              placeholder="e.g., Governors Club Bocce League"
            />
          </div>
        </Card>

        {/* Game Rules */}
        <Card title="Game Rules">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Points to Win"
              type="number"
              min="1"
              value={formData.pointsToWin}
              onChange={(e) =>
                setFormData({ ...formData, pointsToWin: parseInt(e.target.value) || 12 })
              }
            />
            <Input
              label="Games Per Match"
              type="number"
              min="1"
              max="7"
              value={formData.gamesPerMatch}
              onChange={(e) =>
                setFormData({ ...formData, gamesPerMatch: parseInt(e.target.value) || 3 })
              }
            />
          </div>
          <p className="text-sm text-muted mt-2">
            Standard bocce is played to 12 points, best of 3 games.
          </p>
        </Card>

        {/* Playoff Settings */}
        <Card title="Playoff Settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Playoff Format"
              value={formData.playoffFormat}
              onChange={(e) => setFormData({ ...formData, playoffFormat: e.target.value })}
              options={[
                { value: 'single', label: 'Single Elimination' },
                { value: 'double', label: 'Double Elimination' },
              ]}
            />
            <Input
              label="Teams in Playoffs"
              type="number"
              min="2"
              max="32"
              value={formData.teamsInPlayoffs}
              onChange={(e) =>
                setFormData({ ...formData, teamsInPlayoffs: parseInt(e.target.value) || 8 })
              }
            />
          </div>
          <p className="text-sm text-muted mt-2">
            Recommended: 4, 8, or 16 teams for clean bracket formatting.
          </p>
        </Card>

        {/* Branding */}
        <Card title="Branding Colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-12 h-12 rounded cursor-pointer border border-border"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Secondary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="w-12 h-12 rounded cursor-pointer border border-border"
                />
                <Input
                  value={formData.secondaryColor}
                  onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg border border-border">
            <p className="text-sm text-muted mb-2">Preview:</p>
            <div className="flex gap-4">
              <div
                className="w-24 h-12 rounded flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: formData.primaryColor }}
              >
                Primary
              </div>
              <div
                className="w-24 h-12 rounded flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: formData.secondaryColor }}
              >
                Secondary
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <Card title="League Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">
                {formData.playoffFormat === 'single' ? 'Single' : 'Double'}
              </p>
              <p className="text-sm text-muted">Elimination</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{formData.teamsInPlayoffs}</p>
              <p className="text-sm text-muted">Playoff Teams</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{formData.pointsToWin}</p>
              <p className="text-sm text-muted">Points to Win</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">Best of {formData.gamesPerMatch}</p>
              <p className="text-sm text-muted">Match Format</p>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
