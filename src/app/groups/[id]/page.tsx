'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Room {
  id: string;
  name: string;
  capacity: number;
}

interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string;
  joinedAt: string;
}

interface MembershipRequest {
  id: string;
  name: string;
  email: string;
  status: string;
  requestedAt: string;
}

interface Meeting {
  id: string;
  title: string | null;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  roomCapacity: string;
  room: Room;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  topic: string;
  createdAt: string;
  members: Member[];
  membershipRequests: MembershipRequest[];
  meetings: Meeting[];
}

interface CurrentMember {
  id: string;
  name: string;
  email: string | null;
}

interface Message {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState<CurrentMember | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/groups/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/groups');
          return;
        }
        throw new Error('Failed to fetch group');
      }
      const data = await res.json();
      setGroup(data);
    } catch (error) {
      console.error('Failed to fetch group:', error);
      toast.error('Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/groups/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handlePostMessage = async () => {
    if (!newMessage.trim() || !currentMember) return;

    // Find the member's ID in this group
    const groupMember = group?.members.find(
      (m) => m.id === currentMember.id || m.email === currentMember.email
    );

    if (!groupMember) {
      toast.error('You must be a member to post messages');
      return;
    }

    setSendingMessage(true);
    try {
      const res = await fetch(`/api/groups/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: groupMember.id,
          authorName: groupMember.name,
          content: newMessage.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post message');
      }

      setNewMessage('');
      fetchMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post message');
    } finally {
      setSendingMessage(false);
    }
  };

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

  useEffect(() => {
    fetchGroup();
    fetchMessages();
  }, [id]);

  const isLead = group?.members.some(
    (m) => m.id === currentMember?.id && m.role === 'lead'
  );

  const isMember = group?.members.some((m) => m.id === currentMember?.id);

  const hasPendingRequest = group?.membershipRequests.some(
    (r) => r.email === currentMember?.email && r.status === 'pending'
  );

  const handleJoinRequest = async () => {
    if (!currentMember?.email) {
      toast.error('Your selected identity needs an email to request membership');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`/api/groups/${id}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentMember.name,
          email: currentMember.email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      toast.success('Membership request submitted!');
      setShowJoinModal(false);
      fetchGroup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setJoining(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/groups/${id}/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process request');
      }

      toast.success(action === 'approve' ? 'Member approved!' : 'Request rejected');
      fetchGroup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process request');
    }
  };

  const handlePromoteMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/groups/${id}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'lead' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to promote member');
      }

      toast.success('Member promoted to lead');
      fetchGroup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to promote member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const res = await fetch(`/api/groups/${id}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      toast.success('Member removed');
      fetchGroup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

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

  const getRoomCapacityLabel = (capacity: string) => {
    const labels: Record<string, string> = {
      QUARTER: '1/4 Room',
      HALF: '1/2 Room',
      THREE_QUARTER: '3/4 Room',
      FULL: 'Full Room',
    };
    return labels[capacity] || capacity;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading group...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Group not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/groups" className="text-indigo-600 hover:text-indigo-800 text-sm mb-4 inline-flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Groups
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTopicColor(group.topic)}`}>
                {group.topic}
              </span>
            </div>
            {group.description && (
              <p className="text-gray-600">{group.description}</p>
            )}
          </div>
          {!isMember && !hasPendingRequest && currentMember && (
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Request to Join
            </button>
          )}
          {hasPendingRequest && (
            <span className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg">
              Request Pending
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Upcoming Meetings */}
          <Card title="Upcoming Meetings" action={
            isLead && (
              <Link
                href={`/groups/${id}/schedule`}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Manage Schedule
              </Link>
            )
          }>
            {group.meetings.length > 0 ? (
              <div className="space-y-4">
                {group.meetings.map((meeting) => (
                  <div key={meeting.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {meeting.title || 'Group Meeting'}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {format(new Date(meeting.date), 'EEEE, MMMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {meeting.startTime} - {meeting.endTime}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-900">{meeting.room.name}</p>
                        <p className="text-gray-500">{getRoomCapacityLabel(meeting.roomCapacity)}</p>
                      </div>
                    </div>
                    {meeting.description && (
                      <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No upcoming meetings scheduled</p>
            )}
          </Card>

          {/* Message Board */}
          <Card title="Message Board">
            {/* Message List */}
            <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 font-medium text-sm">
                        {message.authorName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-gray-900 text-sm">
                          {message.authorName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No messages yet. Start the conversation!
                </p>
              )}
            </div>

            {/* Message Input */}
            {isMember ? (
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostMessage();
                      }
                    }}
                    placeholder="Write a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    disabled={sendingMessage}
                  />
                  <button
                    onClick={handlePostMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 text-center">
                  Join this group to participate in discussions
                </p>
              </div>
            )}
          </Card>

          {/* Membership Requests (Leads Only) */}
          {isLead && group.membershipRequests.length > 0 && (
            <Card title="Pending Requests">
              <div className="space-y-3">
                {group.membershipRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{request.name}</p>
                      <p className="text-sm text-gray-600">{request.email}</p>
                      <p className="text-xs text-gray-500">
                        Requested {format(new Date(request.requestedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequestAction(request.id, 'approve')}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRequestAction(request.id, 'reject')}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Members */}
          <Card title={`Members (${group.members.length})`}>
            <div className="space-y-3">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-medium text-sm">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      {member.role === 'lead' && (
                        <span className="text-xs text-purple-600">Lead</span>
                      )}
                    </div>
                  </div>
                  {isLead && member.id !== currentMember?.id && (
                    <div className="flex gap-1">
                      {member.role !== 'lead' && (
                        <button
                          onClick={() => handlePromoteMember(member.id)}
                          title="Promote to Lead"
                          className="p-1 text-gray-400 hover:text-indigo-600"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        title="Remove Member"
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {isLead && (
              <Link
                href={`/groups/${id}/members`}
                className="block text-center text-sm text-indigo-600 hover:text-indigo-800 mt-4 pt-4 border-t"
              >
                Manage Members
              </Link>
            )}
          </Card>

          {/* Group Info */}
          <Card title="Group Info">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{format(new Date(group.createdAt), 'MMMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Leads</dt>
                <dd className="text-gray-900">
                  {group.members.filter((m) => m.role === 'lead').map((m) => m.name).join(', ')}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request to Join</h3>
            <p className="text-gray-600 mb-6">
              Your request will be sent to the group leads for approval. You&apos;ll be notified once they respond.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Requesting as:</p>
              <p className="font-medium text-gray-900">{currentMember?.name}</p>
              <p className="text-sm text-gray-500">{currentMember?.email}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinRequest}
                disabled={joining}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {joining ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
