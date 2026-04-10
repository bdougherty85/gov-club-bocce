'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';

interface GroupMember {
  id: string;
  name: string;
  role: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  topic: string;
  memberCount: number;
  leads: GroupMember[];
  upcomingMeetingCount: number;
  isMember: boolean;
}

interface GroupsData {
  groups: Group[];
  topics: string[];
}

export default function GroupsListPage() {
  const [data, setData] = useState<GroupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMemberId, setCurrentMemberId] = useState<string>('');

  const fetchGroups = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTopic) params.set('topic', selectedTopic);
      if (currentMemberId) params.set('memberId', currentMemberId);

      const res = await fetch(`/api/groups?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('groupsMemberIdentity');
    if (saved) {
      try {
        const member = JSON.parse(saved);
        setCurrentMemberId(member.id);
      } catch {
        // ignore
      }
    }

    const handleMemberChange = (e: CustomEvent) => {
      setCurrentMemberId(e.detail?.id || '');
    };

    window.addEventListener('groupsMemberChanged', handleMemberChange as EventListener);
    return () => {
      window.removeEventListener('groupsMemberChanged', handleMemberChange as EventListener);
    };
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [selectedTopic, currentMemberId]);

  const filteredGroups = data?.groups.filter((group) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      group.name.toLowerCase().includes(q) ||
      group.description?.toLowerCase().includes(q) ||
      group.topic.toLowerCase().includes(q)
    );
  });

  const getTopicColor = (topic: string) => {
    const colors: Record<string, string> = {
      Wine: 'bg-purple-100 text-purple-800',
      Books: 'bg-blue-100 text-blue-800',
      Finance: 'bg-green-100 text-green-800',
      Golf: 'bg-emerald-100 text-emerald-800',
      Cards: 'bg-amber-100 text-amber-800',
      Travel: 'bg-cyan-100 text-cyan-800',
      Art: 'bg-pink-100 text-pink-800',
      Music: 'bg-indigo-100 text-indigo-800',
      Food: 'bg-orange-100 text-orange-800',
      Sports: 'bg-red-100 text-red-800',
    };
    return colors[topic] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interest Groups</h1>
          <p className="text-gray-600 mt-1">
            Discover and join groups that match your interests
          </p>
        </div>
        <Link
          href="/groups/create"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Group
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Topics</option>
          {data?.topics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{data?.groups.length || 0}</p>
          <p className="text-sm text-gray-500">Total Groups</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{data?.topics.length || 0}</p>
          <p className="text-sm text-gray-500">Topics</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-green-600">
            {data?.groups.filter((g) => g.isMember).length || 0}
          </p>
          <p className="text-sm text-gray-500">My Groups</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">
            {data?.groups.reduce((acc, g) => acc + g.upcomingMeetingCount, 0) || 0}
          </p>
          <p className="text-sm text-gray-500">Upcoming Meetings</p>
        </Card>
      </div>

      {/* Groups Grid */}
      {filteredGroups && filteredGroups.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTopicColor(group.topic)}`}>
                    {group.topic}
                  </span>
                  {group.isMember && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      Member
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{group.description}</p>
                )}
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      {group.memberCount} members
                    </span>
                    {group.upcomingMeetingCount > 0 && (
                      <span className="flex items-center text-indigo-600">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {group.upcomingMeetingCount} upcoming
                      </span>
                    )}
                  </div>
                  {group.leads.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      Led by: {group.leads.map((l) => l.name).join(', ')}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No groups found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || selectedTopic
              ? 'Try adjusting your search or filters'
              : 'Be the first to create an interest group!'}
          </p>
          <Link
            href="/groups/create"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Create Group
          </Link>
        </div>
      )}
    </div>
  );
}
