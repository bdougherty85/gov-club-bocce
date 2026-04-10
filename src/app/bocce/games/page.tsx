'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Team {
  id: string;
  name: string;
  division: { name: string };
}

interface Game {
  id: string;
  scheduledDate: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scoreboardPhoto: string | null;
  notes: string | null;
  isPlayoff: boolean;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [filter, setFilter] = useState('all');
  const [formData, setFormData] = useState({
    homeScore: '',
    awayScore: '',
    status: 'completed',
    notes: '',
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/games');
      const data = await res.json();
      setGames(data);
    } catch (error) {
      toast.error('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame) return;

    try {
      const res = await fetch(`/api/games/${selectedGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeScore: parseInt(formData.homeScore) || null,
          awayScore: parseInt(formData.awayScore) || null,
          status: formData.status,
          notes: formData.notes || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update game');

      toast.success('Game updated!');
      setModalOpen(false);
      setSelectedGame(null);
      fetchGames();
    } catch (error) {
      toast.error('Failed to update game');
    }
  };

  const [extracting, setExtracting] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGame) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      const { url } = await uploadRes.json();

      // Update game with photo URL
      const res = await fetch(`/api/games/${selectedGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreboardPhoto: url }),
      });

      if (!res.ok) throw new Error('Failed to save photo');

      toast.success('Photo uploaded!');

      // Update the selected game with the new photo URL
      setSelectedGame({ ...selectedGame, scoreboardPhoto: url });
      fetchGames();

      // Automatically try to extract scores from the photo
      extractScoresFromPhoto(url);
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const extractScoresFromPhoto = async (imageUrl: string) => {
    if (!selectedGame) return;

    setExtracting(true);
    try {
      const res = await fetch('/api/extract-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          homeTeamName: selectedGame.homeTeam.name,
          awayTeamName: selectedGame.awayTeam.name,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.error === 'AI service not configured') {
          toast.error('AI score extraction not configured. Please enter scores manually.');
          return;
        }
        throw new Error('Failed to extract scores');
      }

      const result = await res.json();

      if (result.homeScore !== null && result.awayScore !== null) {
        // Auto-fill the score fields
        setFormData({
          ...formData,
          homeScore: result.homeScore.toString(),
          awayScore: result.awayScore.toString(),
          status: 'completed',
        });

        if (result.confidence === 'high') {
          toast.success(`Scores extracted: ${result.homeScore} - ${result.awayScore}`);
        } else {
          toast.success(
            `Scores extracted (${result.confidence} confidence): ${result.homeScore} - ${result.awayScore}. Please verify.`
          );
        }
      } else {
        toast.error(`Could not extract scores: ${result.rawText || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Score extraction error:', error);
      toast.error('Failed to extract scores. Please enter manually.');
    } finally {
      setExtracting(false);
    }
  };

  const openScoreModal = (game: Game) => {
    setSelectedGame(game);
    setFormData({
      homeScore: game.homeScore?.toString() || '',
      awayScore: game.awayScore?.toString() || '',
      status: game.status,
      notes: game.notes || '',
    });
    setModalOpen(true);
  };

  const filteredGames = games.filter((game) => {
    if (filter === 'all') return true;
    if (filter === 'scheduled') return game.status === 'scheduled';
    if (filter === 'completed') return game.status === 'completed';
    if (filter === 'playoff') return game.isPlayoff;
    return true;
  });

  const getStatusBadge = (status: string, isPlayoff: boolean) => {
    if (isPlayoff) {
      return (
        <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
          Playoff
        </span>
      );
    }

    const styles: Record<string, string> = {
      scheduled: 'bg-primary/10 text-primary',
      in_progress: 'bg-warning/10 text-warning',
      completed: 'bg-success/10 text-success',
      cancelled: 'bg-error/10 text-error',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Games & Scores</h1>
          <p className="text-muted mt-1">Manage game scores and upload scoreboard photos</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-2">
          {['all', 'scheduled', 'completed', 'playoff'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-foreground hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted">Loading games...</div>
      ) : filteredGames.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-muted">No games found. Create a schedule first!</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGames.map((game) => (
            <Card key={game.id}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm text-muted">
                      {new Date(game.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {getStatusBadge(game.status, game.isPlayoff)}
                  </div>

                  <div className="flex items-center justify-between md:justify-start gap-4">
                    <div className="text-center md:text-left">
                      <p className="font-semibold text-lg text-foreground">{game.homeTeam.name}</p>
                      <p className="text-xs text-muted">{game.homeTeam.division.name}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {game.status === 'completed' ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                          <span className="text-2xl font-bold text-foreground">
                            {game.homeScore}
                          </span>
                          <span className="text-muted">-</span>
                          <span className="text-2xl font-bold text-foreground">
                            {game.awayScore}
                          </span>
                        </div>
                      ) : (
                        <span className="px-4 py-2 text-muted font-medium">vs</span>
                      )}
                    </div>

                    <div className="text-center md:text-right">
                      <p className="font-semibold text-lg text-foreground">{game.awayTeam.name}</p>
                      <p className="text-xs text-muted">{game.awayTeam.division.name}</p>
                    </div>
                  </div>

                  {game.notes && (
                    <p className="mt-2 text-sm text-muted italic">{game.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {game.scoreboardPhoto && (
                    <a
                      href={game.scoreboardPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Photo
                    </a>
                  )}
                  <Button size="sm" onClick={() => openScoreModal(game)}>
                    {game.status === 'completed' ? 'Edit Score' : 'Enter Score'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Score Entry Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedGame ? `${selectedGame.homeTeam.name} vs ${selectedGame.awayTeam.name}` : ''}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Score Entry */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {selectedGame?.homeTeam.name}
              </label>
              <Input
                type="number"
                min="0"
                value={formData.homeScore}
                onChange={(e) => setFormData({ ...formData, homeScore: e.target.value })}
                className="text-center text-2xl font-bold"
              />
            </div>
            <div className="text-center text-2xl text-muted font-bold pb-2">-</div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {selectedGame?.awayTeam.name}
              </label>
              <Input
                type="number"
                min="0"
                value={formData.awayScore}
                onChange={(e) => setFormData({ ...formData, awayScore: e.target.value })}
                className="text-center text-2xl font-bold"
              />
            </div>
          </div>

          {/* Status */}
          <Select
            label="Game Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Any additional notes about the game..."
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Scoreboard Photo
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || extracting}
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              {selectedGame?.scoreboardPhoto && (
                <>
                  <a
                    href={selectedGame.scoreboardPhoto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View Current Photo
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => extractScoresFromPhoto(selectedGame.scoreboardPhoto!)}
                    disabled={extracting || uploading}
                  >
                    {extracting ? 'Analyzing...' : 'Extract Scores with AI'}
                  </Button>
                </>
              )}
            </div>
            {extracting && (
              <p className="text-sm text-muted mt-2 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AI is analyzing the scoreboard photo...
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Score</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
