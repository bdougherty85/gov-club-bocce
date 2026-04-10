'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  name: string;
  email: string | null;
}

const TOPICS = [
  'Wine',
  'Books',
  'Finance',
  'Golf',
  'Cards',
  'Travel',
  'Art',
  'Music',
  'Food',
  'Sports',
  'Photography',
  'Gardening',
  'Technology',
  'Fitness',
  'Other',
];

export default function CreateGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    topic: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('groupsMemberIdentity');
    if (saved) {
      try {
        setCurrentMember(JSON.parse(saved));
      } catch {
        // ignore
      }
    }

    const handleMemberChange = (e: CustomEvent) => {
      setCurrentMember(e.detail || null);
    };

    window.addEventListener('groupsMemberChanged', handleMemberChange as EventListener);
    return () => {
      window.removeEventListener('groupsMemberChanged', handleMemberChange as EventListener);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentMember) {
      toast.error('Please select your identity from the navigation bar first');
      return;
    }

    if (!formData.name.trim() || !formData.topic) {
      toast.error('Name and topic are required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          topic: formData.topic,
          creatorName: currentMember.name,
          creatorEmail: currentMember.email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group');
      }

      const group = await res.json();
      toast.success('Group created successfully!');
      router.push(`/groups/${group.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Interest Group</h1>
      <p className="text-gray-600 mb-8">
        Start a new group and invite members who share your interests
      </p>

      {!currentMember && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800">
            Please select your identity from the dropdown in the navigation bar before creating a group.
            You will automatically become the group lead.
          </p>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Wine Enthusiasts Club"
              required
            />
          </div>

          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
              Topic *
            </label>
            <select
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              <option value="">Select a topic</option>
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Describe what your group is about, meeting frequency, who should join..."
            />
          </div>

          {currentMember && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-sm text-indigo-800">
                <strong>{currentMember.name}</strong> will be the group lead.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentMember}
              className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
