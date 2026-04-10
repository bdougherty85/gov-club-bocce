'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { format } from 'date-fns';

interface DashboardData {
  counts: {
    open: number;
    inProgress: number;
    completed: number;
    blocked: number;
    overdue: number;
  };
  trafficLights: {
    red: number;
    yellow: number;
    green: number;
  };
  blockedTasks: Array<{
    id: string;
    title: string;
    blockerDescription: string | null;
    priority: string;
    department: { name: string } | null;
    assignedTo: { name: string } | null;
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    estimatedDate: string;
    priority: string;
    department: { name: string } | null;
    assignedTo: { name: string } | null;
  }>;
  recentUpdates: Array<{
    id: string;
    notes: string;
    trafficLight: string;
    createdAt: string;
    staff: { name: string };
    actionItem: { title: string };
  }>;
  currentStaff: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export default function StaffDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStaffId, setCurrentStaffId] = useState<string>('');

  const fetchDashboard = async (staffId?: string) => {
    try {
      const url = staffId
        ? `/api/staff/dashboard?staffId=${staffId}`
        : '/api/staff/dashboard';
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('staffIdentity');
    if (saved) setCurrentStaffId(saved);
    fetchDashboard(saved || undefined);

    const handleIdentityChange = (e: CustomEvent) => {
      setCurrentStaffId(e.detail);
      fetchDashboard(e.detail);
    };

    window.addEventListener(
      'staffIdentityChanged',
      handleIdentityChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'staffIdentityChanged',
        handleIdentityChange as EventListener
      );
    };
  }, []);

  const getTrafficLightColor = (light: string) => {
    switch (light) {
      case 'Red':
        return 'bg-red-500';
      case 'Yellow':
        return 'bg-yellow-500';
      case 'Green':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const isManager = data?.currentStaff?.role === 'Manager';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Staff Task Dashboard</h1>
        {data?.currentStaff && (
          <p className="text-gray-600 mt-1">
            Welcome, {data.currentStaff.name}
          </p>
        )}
        {!currentStaffId && (
          <p className="text-amber-600 mt-2 text-sm">
            Please select your identity from the dropdown above to see personalized data.
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{data?.counts.open || 0}</p>
          <p className="text-sm text-gray-500">Open</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">
            {data?.counts.inProgress || 0}
          </p>
          <p className="text-sm text-gray-500">In Progress</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-green-600">
            {data?.counts.completed || 0}
          </p>
          <p className="text-sm text-gray-500">Completed</p>
        </Card>
        <Card
          className={`p-4 text-center ${
            (data?.counts.blocked || 0) > 0 ? 'ring-2 ring-red-400' : ''
          }`}
        >
          <p className="text-3xl font-bold text-red-600">
            {data?.counts.blocked || 0}
          </p>
          <p className="text-sm text-gray-500">Blocked</p>
        </Card>
        <Card
          className={`p-4 text-center ${
            (data?.counts.overdue || 0) > 0 ? 'ring-2 ring-amber-400' : ''
          }`}
        >
          <p className="text-3xl font-bold text-amber-600">
            {data?.counts.overdue || 0}
          </p>
          <p className="text-sm text-gray-500">Overdue</p>
        </Card>
      </div>

      {/* Traffic Light Summary */}
      <div className="flex items-center gap-6 mb-8 p-4 bg-white rounded-lg shadow-sm border">
        <span className="text-sm font-medium text-gray-700">Task Health:</span>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-green-500"></span>
          <span className="text-sm">{data?.trafficLights.green || 0} On Track</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
          <span className="text-sm">
            {data?.trafficLights.yellow || 0} Needs Attention
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-red-500"></span>
          <span className="text-sm">{data?.trafficLights.red || 0} At Risk</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Blocked Tasks - Managers Only */}
        {isManager && (data?.blockedTasks?.length || 0) > 0 && (
          <Card title="Blocked Tasks - Action Required" className="md:col-span-2">
            <div className="divide-y">
              {data?.blockedTasks.map((task) => (
                <div key={task.id} className="py-3 flex items-start gap-4">
                  <span className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></span>
                  <div className="flex-1">
                    <Link
                      href={`/staff/tasks?id=${task.id}`}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {task.title}
                    </Link>
                    <p className="text-sm text-red-600 mt-1">
                      {task.blockerDescription || 'No blocker description provided'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span
                        className={`px-2 py-0.5 rounded ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                      {task.department && <span>{task.department.name}</span>}
                      {task.assignedTo && (
                        <span>Assigned to: {task.assignedTo.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Overdue Tasks */}
        {(data?.overdueTasks?.length || 0) > 0 && (
          <Card title="Overdue Tasks">
            <div className="divide-y">
              {data?.overdueTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="py-3">
                  <Link
                    href={`/staff/tasks?id=${task.id}`}
                    className="font-medium text-gray-900 hover:text-primary"
                  >
                    {task.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="text-red-600">
                      Due: {format(new Date(task.estimatedDate), 'MMM d, yyyy')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                    {task.assignedTo && <span>{task.assignedTo.name}</span>}
                  </div>
                </div>
              ))}
            </div>
            {(data?.overdueTasks?.length || 0) > 5 && (
              <Link
                href="/staff/tasks?overdue=true"
                className="block text-center text-sm text-primary hover:underline mt-3"
              >
                View all {data?.overdueTasks.length} overdue tasks
              </Link>
            )}
          </Card>
        )}

        {/* Recent Activity */}
        <Card title="Recent Activity">
          {data?.recentUpdates && data.recentUpdates.length > 0 ? (
            <div className="divide-y">
              {data.recentUpdates.slice(0, 5).map((update) => (
                <div key={update.id} className="py-3 flex items-start gap-3">
                  <span
                    className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${getTrafficLightColor(
                      update.trafficLight
                    )}`}
                  ></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {update.actionItem.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{update.notes}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {update.staff.name} &bull;{' '}
                      {format(new Date(update.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-4">No recent activity</p>
          )}
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div className="space-y-3">
            <Link
              href="/staff/tasks"
              className="block w-full text-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              View All Tasks
            </Link>
            {(isManager || data?.currentStaff?.role === 'Lead') && (
              <Link
                href="/staff/tasks?new=true"
                className="block w-full text-center px-4 py-2 bg-secondary text-primary rounded-md hover:bg-secondary-dark transition-colors"
              >
                Create New Task
              </Link>
            )}
            <Link
              href="/staff/completed"
              className="block w-full text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              View Completed Tasks
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
