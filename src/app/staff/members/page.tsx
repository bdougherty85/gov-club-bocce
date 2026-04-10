'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface Staff {
  id: string;
  name: string;
  email: string | null;
  role: string;
  title: string | null;
  isActive: boolean;
  department: { id: string; name: string } | null;
  _count: { assignedTasks: number };
}

interface Department {
  id: string;
  name: string;
}

export default function StaffMembersPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Staff',
    title: '',
    departmentId: '',
  });
  const [filterDept, setFilterDept] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDept) params.append('departmentId', filterDept);
      if (filterRole) params.append('role', filterRole);

      const [staffRes, deptsRes] = await Promise.all([
        fetch(`/api/staff/members?${params}`),
        fetch('/api/staff/departments'),
      ]);

      const [staffData, deptsData] = await Promise.all([
        staffRes.json(),
        deptsRes.json(),
      ]);

      setStaff(staffData);
      setDepartments(deptsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDept, filterRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingStaff
        ? `/api/staff/members/${editingStaff.id}`
        : '/api/staff/members';
      const method = editingStaff ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          departmentId: formData.departmentId || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save staff member');
      }

      toast.success(editingStaff ? 'Staff member updated!' : 'Staff member added!');
      setShowModal(false);
      setEditingStaff(null);
      setFormData({ name: '', email: '', role: 'Staff', title: '', departmentId: '' });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save staff member');
    }
  };

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
    setFormData({
      name: s.name,
      email: s.email || '',
      role: s.role,
      title: s.title || '',
      departmentId: s.department?.id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (s: Staff) => {
    if (!confirm(`Are you sure you want to delete "${s.name}"?`)) return;

    try {
      const res = await fetch(`/api/staff/members/${s.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Staff member removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete staff member');
    }
  };

  const handleAddNew = () => {
    setEditingStaff(null);
    setFormData({ name: '', email: '', role: 'Staff', title: '', departmentId: '' });
    setShowModal(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Manager':
        return 'bg-purple-100 text-purple-800';
      case 'Lead':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">Loading staff members...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Members</h1>
        <Button onClick={handleAddNew}>Add Staff Member</Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 max-w-md">
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
            label="Role"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'Manager', label: 'Manager' },
              { value: 'Lead', label: 'Lead' },
              { value: 'Staff', label: 'Staff' },
            ]}
          />
        </div>
      </Card>

      {/* Staff List */}
      <Card>
        {staff.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No staff members found</p>
        ) : (
          <div className="divide-y">
            {staff.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{s.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded ${getRoleBadge(s.role)}`}>
                      {s.role}
                    </span>
                    {!s.isActive && (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </div>
                  {s.title && <p className="text-sm text-gray-600">{s.title}</p>}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {s.department && <span>{s.department.name}</span>}
                    {s.email && <span>{s.email}</span>}
                    <span>{s._count.assignedTasks} assigned tasks</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleEdit(s)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(s)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Job Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Bartender, Head Chef"
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={[
              { value: 'Manager', label: 'Manager' },
              { value: 'Lead', label: 'Lead' },
              { value: 'Staff', label: 'Staff' },
            ]}
          />
          <Select
            label="Department"
            value={formData.departmentId}
            onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
            options={[
              { value: '', label: 'No Department' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingStaff ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
