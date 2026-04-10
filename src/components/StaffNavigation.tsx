'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface Staff {
  id: string;
  name: string;
  role: string;
  title: string | null;
  department: { name: string } | null;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  trafficLight: string;
  isBlocked: boolean;
  assignedTo: { name: string } | null;
  department: { name: string } | null;
}

const navItems = [
  { href: '/staff', label: 'Dashboard' },
  { href: '/staff/tasks', label: 'Active Tasks' },
  { href: '/staff/completed', label: 'Completed' },
  { href: '/staff/departments', label: 'Departments' },
  { href: '/staff/members', label: 'Staff' },
];

export default function StaffNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState<string>('');
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);

  // Tasks dropdown state
  const [tasksDropdownOpen, setTasksDropdownOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateTrafficLight, setUpdateTrafficLight] = useState('Green');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load saved staff identity
    const saved = localStorage.getItem('staffIdentity');
    if (saved) setCurrentStaffId(saved);

    // Fetch all staff members
    fetch('/api/staff/members')
      .then((res) => res.json())
      .then((data) => setStaffMembers(data))
      .catch(console.error);

    // Fetch active tasks
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/staff/tasks?completed=false');
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  useEffect(() => {
    if (currentStaffId && staffMembers.length > 0) {
      const found = staffMembers.find((s) => s.id === currentStaffId);
      setCurrentStaff(found || null);
    }
  }, [currentStaffId, staffMembers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTasksDropdownOpen(false);
        setSelectedTask(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStaffChange = (staffId: string) => {
    setCurrentStaffId(staffId);
    localStorage.setItem('staffIdentity', staffId);
    window.dispatchEvent(new CustomEvent('staffIdentityChanged', { detail: staffId }));
  };

  const handleQuickUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !updateNotes.trim()) return;

    try {
      const res = await fetch(`/api/staff/tasks/${selectedTask.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaffId || staffMembers[0]?.id,
          trafficLight: updateTrafficLight,
          notes: updateNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to add update');

      toast.success('Status update added!');
      setUpdateNotes('');
      setUpdateTrafficLight('Green');
      setSelectedTask(null);
      fetchTasks();

      // Notify other components
      window.dispatchEvent(new CustomEvent('taskUpdated'));
    } catch (error) {
      toast.error('Failed to add update');
    }
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/staff/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(`Task marked as ${newStatus}`);
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskUpdated'));
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Manager': return 'bg-purple-500';
      case 'Lead': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrafficLightColor = (light: string) => {
    switch (light) {
      case 'Red': return 'bg-red-500';
      case 'Yellow': return 'bg-yellow-500';
      case 'Green': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <nav className="bg-primary shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/staff" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-xl">GC</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">
                Staff Tasks
              </span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-secondary text-primary'
                    : 'text-white hover:bg-primary-light'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Tasks Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => { setTasksDropdownOpen(!tasksDropdownOpen); setSelectedTask(null); }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  tasksDropdownOpen ? 'bg-secondary text-primary' : 'text-white hover:bg-primary-light'
                }`}
              >
                <span>Quick Update</span>
                <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{tasks.length}</span>
                <svg className={`w-4 h-4 transition-transform ${tasksDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {tasksDropdownOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                  {selectedTask ? (
                    // Quick Update Form
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 truncate flex-1">{selectedTask.title}</h4>
                        <button
                          onClick={() => setSelectedTask(null)}
                          className="text-gray-400 hover:text-gray-600 ml-2"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <form onSubmit={handleQuickUpdate} className="space-y-3">
                        <div className="flex gap-3">
                          {['Green', 'Yellow', 'Red'].map((color) => (
                            <label key={color} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name="trafficLight"
                                value={color}
                                checked={updateTrafficLight === color}
                                onChange={(e) => setUpdateTrafficLight(e.target.value)}
                                className="sr-only"
                              />
                              <span className={`w-5 h-5 rounded-full border-2 ${
                                updateTrafficLight === color ? 'border-gray-800' : 'border-transparent'
                              } ${getTrafficLightColor(color)}`}></span>
                              <span className="text-xs text-gray-600">
                                {color === 'Green' ? 'On Track' : color === 'Yellow' ? 'Attention' : 'At Risk'}
                              </span>
                            </label>
                          ))}
                        </div>
                        <textarea
                          value={updateNotes}
                          onChange={(e) => setUpdateNotes(e.target.value)}
                          placeholder="Add your status update..."
                          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          rows={2}
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark"
                          >
                            Add Update
                          </button>
                          {selectedTask.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(selectedTask.id, 'Completed')}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  ) : (
                    // Task List
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b">
                        <h3 className="font-medium text-gray-700 text-sm">Active Tasks ({tasks.length})</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {tasks.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-4">No active tasks</p>
                        ) : (
                          tasks.map((task) => (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            >
                              <div className="flex items-start gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getTrafficLightColor(task.trafficLight)}`}></span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 text-sm truncate">{task.title}</span>
                                    {task.isBlocked && (
                                      <span className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded">BLOCKED</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                    <span className={getPriorityColor(task.priority)}>{task.priority}</span>
                                    <span>•</span>
                                    <span>{task.status}</span>
                                    {task.assignedTo && (
                                      <>
                                        <span>•</span>
                                        <span>{task.assignedTo.name}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-4 py-2 bg-gray-50 border-t">
                        <Link
                          href="/staff/tasks"
                          onClick={() => setTasksDropdownOpen(false)}
                          className="text-primary text-sm hover:underline"
                        >
                          View all tasks →
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Staff selector */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center">
              {currentStaff && (
                <span
                  className={`px-2 py-0.5 rounded text-xs text-white mr-2 ${getRoleBadgeColor(
                    currentStaff.role
                  )}`}
                >
                  {currentStaff.role}
                </span>
              )}
              <select
                value={currentStaffId}
                onChange={(e) => handleStaffChange(e.target.value)}
                className="bg-primary-light text-white text-sm rounded-md px-3 py-1.5 border border-primary-light focus:outline-none focus:ring-2 focus:ring-secondary"
              >
                <option value="">Select Identity</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} {staff.title ? `- ${staff.title}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white hover:text-secondary p-2"
                aria-label="Toggle menu"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-primary-dark">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* Mobile staff selector */}
            <div className="px-3 py-2">
              <label className="block text-xs text-gray-300 mb-1">
                Logged in as:
              </label>
              <select
                value={currentStaffId}
                onChange={(e) => handleStaffChange(e.target.value)}
                className="w-full bg-primary-light text-white text-sm rounded-md px-3 py-2 border border-primary-light"
              >
                <option value="">Select Identity</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} - {staff.role}
                  </option>
                ))}
              </select>
            </div>

            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === item.href
                    ? 'bg-secondary text-primary'
                    : 'text-white hover:bg-primary-light'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Mobile Quick Update Section */}
            <div className="px-3 py-2 border-t border-primary-light mt-2 pt-2">
              <p className="text-xs text-gray-300 mb-2">Quick Update ({tasks.length} tasks)</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {tasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    href={`/staff/tasks?id=${task.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-2 py-1.5 bg-primary-light rounded text-sm text-white"
                  >
                    <span className={`w-2 h-2 rounded-full ${getTrafficLightColor(task.trafficLight)}`}></span>
                    <span className="truncate">{task.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
