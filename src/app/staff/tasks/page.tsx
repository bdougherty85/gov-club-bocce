'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  trafficLight: string;
  estimatedDate: string | null;
  isBlocked: boolean;
  blockerDescription: string | null;
  department: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  _count: { statusUpdates: number };
}

interface Staff {
  id: string;
  name: string;
  role: string;
  departmentId: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface StatusUpdate {
  id: string;
  trafficLight: string;
  notes: string;
  createdAt: string;
  staff: { name: string };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStaffId, setCurrentStaffId] = useState<string>('');

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskUpdates, setTaskUpdates] = useState<StatusUpdate[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Open',
    estimatedDate: '',
    departmentId: '',
    assignedToId: '',
    isBlocked: false,
    blockerDescription: '',
  });

  // Status update form
  const [updateForm, setUpdateForm] = useState({
    trafficLight: 'Green',
    notes: '',
  });

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      params.append('completed', 'false');
      if (filterDept) params.append('departmentId', filterDept);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterStatus) params.append('status', filterStatus);
      if (filterAssignee) params.append('assignedToId', filterAssignee);

      const [tasksRes, deptsRes, staffRes] = await Promise.all([
        fetch(`/api/staff/tasks?${params}`),
        fetch('/api/staff/departments'),
        fetch('/api/staff/members'),
      ]);

      const [tasksData, deptsData, staffData] = await Promise.all([
        tasksRes.json(),
        deptsRes.json(),
        staffRes.json(),
      ]);

      setTasks(tasksData);
      setDepartments(deptsData);
      setStaffMembers(staffData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('staffIdentity');
    if (saved) {
      setCurrentStaffId(saved);
    }
    fetchData();

    const handleIdentityChange = (e: CustomEvent) => {
      setCurrentStaffId(e.detail);
    };
    window.addEventListener('staffIdentityChanged', handleIdentityChange as EventListener);
    return () => {
      window.removeEventListener('staffIdentityChanged', handleIdentityChange as EventListener);
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [filterDept, filterPriority, filterStatus, filterAssignee]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Open',
      estimatedDate: '',
      departmentId: '',
      assignedToId: '',
      isBlocked: false,
      blockerDescription: '',
    });
    setEditingTask(null);
  };

  const handleCreateNew = () => {
    resetForm();
    setShowTaskModal(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      estimatedDate: task.estimatedDate ? task.estimatedDate.split('T')[0] : '',
      departmentId: task.department?.id || '',
      assignedToId: task.assignedTo?.id || '',
      isBlocked: task.isBlocked,
      blockerDescription: task.blockerDescription || '',
    });
    setShowDetailModal(false);
    setShowTaskModal(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingTask
        ? `/api/staff/tasks/${editingTask.id}`
        : '/api/staff/tasks';
      const method = editingTask ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        estimatedDate: formData.estimatedDate || null,
        departmentId: formData.departmentId || null,
        assignedToId: formData.assignedToId || null,
        isBlocked: formData.isBlocked,
        blockerDescription: formData.isBlocked ? formData.blockerDescription : null,
      };

      if (!editingTask) {
        payload.createdById = currentStaffId || staffMembers[0]?.id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save task');
      }

      toast.success(editingTask ? 'Task updated!' : 'Task created!');
      setShowTaskModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const res = await fetch(`/api/staff/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Task deleted!');
      setShowDetailModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleViewTask = async (task: Task) => {
    setSelectedTask(task);
    setShowDetailModal(true);

    try {
      const res = await fetch(`/api/staff/tasks/${task.id}/updates`);
      const updates = await res.json();
      setTaskUpdates(updates);
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      const res = await fetch(`/api/staff/tasks/${selectedTask.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaffId || staffMembers[0]?.id,
          ...updateForm,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add update');
      }

      toast.success('Status update added!');
      setUpdateForm({ trafficLight: 'Green', notes: '' });

      // Refresh updates and task data
      const [updatesRes, taskRes] = await Promise.all([
        fetch(`/api/staff/tasks/${selectedTask.id}/updates`),
        fetch(`/api/staff/tasks/${selectedTask.id}`),
      ]);
      setTaskUpdates(await updatesRes.json());
      setSelectedTask(await taskRes.json());
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add update');
    }
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/staff/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast.success(`Task marked as ${newStatus}`);

      // Refresh the selected task
      if (selectedTask?.id === taskId) {
        const taskRes = await fetch(`/api/staff/tasks/${taskId}`);
        setSelectedTask(await taskRes.json());
      }
      fetchData();
    } catch (error) {
      toast.error('Failed to update task status');
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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Active Tasks</h1>
        <Button onClick={handleCreateNew}>Create Task</Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select
            label="Department"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <Select
            label="Priority"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            options={[
              { value: '', label: 'All Priorities' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'All Active' },
              { value: 'Open', label: 'Open' },
              { value: 'In Progress', label: 'In Progress' },
            ]}
          />
          <Select
            label="Assignee"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            options={[
              { value: '', label: 'All Assignees' },
              ...staffMembers.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </Card>

      {/* Tasks List */}
      <Card>
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No tasks found</p>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => {
              const isOverdue =
                task.estimatedDate &&
                new Date(task.estimatedDate) < new Date() &&
                task.status !== 'Completed';

              return (
                <div
                  key={task.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewTask(task)}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${getTrafficLightColor(
                        task.trafficLight
                      )}`}
                    ></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {task.title}
                        </span>
                        {task.isBlocked && (
                          <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded">
                            BLOCKED
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${getPriorityBadge(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {task.status}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {task.department && <span>{task.department.name}</span>}
                        {task.assignedTo && (
                          <span>Assigned: {task.assignedTo.name}</span>
                        )}
                        {task.estimatedDate && (
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            Due: {format(new Date(task.estimatedDate), 'MMM d, yyyy')}
                          </span>
                        )}
                        <span>{task._count.statusUpdates} updates</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Create/Edit Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); resetForm(); }}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
      >
        <form onSubmit={handleSubmitTask} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'Open', label: 'Open' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Completed', label: 'Completed' },
              ]}
            />
          </div>
          <Input
            label="Estimated Completion Date"
            type="date"
            value={formData.estimatedDate}
            onChange={(e) => setFormData({ ...formData, estimatedDate: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Department"
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              options={[
                { value: '', label: 'No Department' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            <Select
              label="Assign To"
              value={formData.assignedToId}
              onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
              options={[
                { value: '', label: 'Unassigned' },
                ...staffMembers.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div className="border-t pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isBlocked}
                onChange={(e) => setFormData({ ...formData, isBlocked: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Task is Blocked</span>
            </label>
            {formData.isBlocked && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Blocker Description
                </label>
                <textarea
                  value={formData.blockerDescription}
                  onChange={(e) => setFormData({ ...formData, blockerDescription: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={2}
                  placeholder="Describe what's blocking this task..."
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowTaskModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">{editingTask ? 'Save Changes' : 'Create Task'}</Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedTask?.title || 'Task Details'}
        size="lg"
      >
        {selectedTask && (
          <div className="space-y-6">
            {/* Task Info */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={`w-4 h-4 rounded-full ${getTrafficLightColor(
                    selectedTask.trafficLight
                  )}`}
                ></span>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${getPriorityBadge(
                    selectedTask.priority
                  )}`}
                >
                  {selectedTask.priority}
                </span>
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {selectedTask.status}
                </span>
                {selectedTask.isBlocked && (
                  <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded">
                    BLOCKED
                  </span>
                )}
              </div>
              {selectedTask.description && (
                <p className="text-gray-700">{selectedTask.description}</p>
              )}
              {selectedTask.isBlocked && selectedTask.blockerDescription && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-800">Blocker:</p>
                  <p className="text-sm text-red-700">
                    {selectedTask.blockerDescription}
                  </p>
                </div>
              )}
              <div className="mt-3 text-sm text-gray-500 space-y-1">
                {selectedTask.department && (
                  <p>Department: {selectedTask.department.name}</p>
                )}
                <p>Created by: {selectedTask.createdBy.name}</p>
                {selectedTask.assignedTo && (
                  <p>Assigned to: {selectedTask.assignedTo.name}</p>
                )}
                {selectedTask.estimatedDate && (
                  <p>
                    Due: {format(new Date(selectedTask.estimatedDate), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => handleEdit(selectedTask)}>
                Edit Task
              </Button>
              {selectedTask.status === 'Open' && (
                <Button size="sm" variant="outline" onClick={() => handleQuickStatusChange(selectedTask.id, 'In Progress')}>
                  Start Task
                </Button>
              )}
              {selectedTask.status !== 'Completed' && (
                <Button size="sm" onClick={() => handleQuickStatusChange(selectedTask.id, 'Completed')}>
                  Mark Complete
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => handleDelete(selectedTask.id)}>
                Delete
              </Button>
            </div>

            {/* Status Update Form */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Add Status Update</h4>
              <form onSubmit={handleAddUpdate} className="space-y-3">
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="trafficLight"
                      value="Green"
                      checked={updateForm.trafficLight === 'Green'}
                      onChange={(e) => setUpdateForm({ ...updateForm, trafficLight: e.target.value })}
                    />
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    On Track
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="trafficLight"
                      value="Yellow"
                      checked={updateForm.trafficLight === 'Yellow'}
                      onChange={(e) => setUpdateForm({ ...updateForm, trafficLight: e.target.value })}
                    />
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    Needs Attention
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="trafficLight"
                      value="Red"
                      checked={updateForm.trafficLight === 'Red'}
                      onChange={(e) => setUpdateForm({ ...updateForm, trafficLight: e.target.value })}
                    />
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    At Risk
                  </label>
                </div>
                <textarea
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                  placeholder="Add your update notes..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={2}
                  required
                />
                <Button type="submit" size="sm">
                  Add Update
                </Button>
              </form>
            </div>

            {/* Status Updates History */}
            {taskUpdates.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Status History</h4>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {taskUpdates.map((update) => (
                    <div key={update.id} className="flex items-start gap-3 text-sm">
                      <span
                        className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${getTrafficLightColor(
                          update.trafficLight
                        )}`}
                      ></span>
                      <div>
                        <p className="text-gray-700">{update.notes}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {update.staff.name} &bull;{' '}
                          {format(new Date(update.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
