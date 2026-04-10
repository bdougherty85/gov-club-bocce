'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  completedDate: string | null;
  department: { id: string; name: string } | null;
  createdBy: { name: string };
  assignedTo: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function CompletedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      params.append('completed', 'true');
      if (filterDept) params.append('departmentId', filterDept);

      const [tasksRes, deptsRes] = await Promise.all([
        fetch(`/api/staff/tasks?${params}`),
        fetch('/api/staff/departments'),
      ]);

      const [tasksData, deptsData] = await Promise.all([
        tasksRes.json(),
        deptsRes.json(),
      ]);

      // Sort by completed date descending
      tasksData.sort((a: Task, b: Task) => {
        if (!a.completedDate) return 1;
        if (!b.completedDate) return -1;
        return new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime();
      });

      setTasks(tasksData);
      setDepartments(deptsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDept]);

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
        <p className="text-gray-500">Loading completed tasks...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Completed Tasks</h1>

      {/* Filter */}
      <Card className="p-4 mb-6">
        <div className="max-w-xs">
          <Select
            label="Filter by Department"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
      </Card>

      {/* Tasks List */}
      <Card>
        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No completed tasks found</p>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <div key={task.id} className="p-4">
                <div className="flex items-start gap-4">
                  <span className="w-3 h-3 rounded-full mt-1.5 bg-green-500 flex-shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{task.title}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {task.department && <span>{task.department.name}</span>}
                      {task.assignedTo && <span>Completed by: {task.assignedTo.name}</span>}
                      {task.completedDate && (
                        <span>
                          Completed: {format(new Date(task.completedDate), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
