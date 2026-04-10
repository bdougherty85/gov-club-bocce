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
  myRole?: string;
}

interface CurrentMember {
  id: string;
  name: string;
  email: string | null;
}

export default function MyGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState<CurrentMember | null>(null);

  const fetchMyGroups = async (memberId: string) => {
    try {
      const res = await fetch(`/api/groups?memberId=${memberId}`);
      const data = await res.json();
      // Filter to only groups where current user is a member
      const myGroups = data.groups?.filter((g: Group) => g.isMember) || [];
      setGroups(myGroups);
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
        setCurrentMember(member);
        fetchMyGroups(member.id);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    const handleMemberChange = (e: CustomEvent) => {
      const member = e.detail;
      setCurrentMember(member || null);
      if (member?.id) {
        setLoading(true);
        fetchMyGroups(member.id);
      } else {
        setGroups([]);
      }
    };

    window.addEventListener('groupsMemberChanged', handleMemberChange as EventListener);
    return () => {
      window.removeEventListener('groupsMemberChanged', handleMemberChange as EventListener);
    };
  }, []);

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
        <p className="text-gray-500">Loading your groups...</p>
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">My Groups</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 mb-4">
            Please select your identity from the dropdown in the navigation bar to see your groups.
          </p>
          <Link
            href="/groups"
            className="text-indigo-600 hover:text-indigo-800"
          >
            Browse all groups
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Groups</h1>
        <p className="text-gray-600 mt-1">
          Groups you&apos;re a member of, {currentMember.name}
        </p>
      </div>

      {groups.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            const myMembership = group.leads.find((l) => l.id === currentMember.id);
            const isLead = myMembership?.role === 'lead';

            return (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTopicColor(group.topic)}`}>
                      {group.topic}
                    </span>
                    {isLead ? (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        Lead
                      </span>
                    ) : (
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
                  </div>
                </Card>
              </Link>
            );
          })}
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
          <h3 className="text-lg font-medium text-gray-900 mb-1">No groups yet</h3>
          <p className="text-gray-500 mb-4">
            You haven&apos;t joined any groups yet. Browse available groups or create your own!
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/groups"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Browse Groups
            </Link>
            <Link
              href="/groups/create"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create Group
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
