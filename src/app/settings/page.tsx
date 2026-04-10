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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    leagueName: '',
    playoffFormat: 'single',
    teamsInPlayoffs: 8,
    gamesPerMatch: 3,
    pointsToWin: 12,
    primaryColor: '#1B4D3E',
    secondaryColor: '#C5A572',
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

  useEffect(() => {
    fetchSettings();
  }, []);

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
