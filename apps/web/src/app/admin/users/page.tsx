'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import { RoleGate, useAuth } from '@/lib/auth';

interface UserItem {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  canApprove: boolean;
}

export default function UsersAdminPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'STAFF' | 'MANAGEMENT' | 'ADMIN'>('STAFF');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ items: UserItem[]; total: number }>('/users?take=50');
      setUsers(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      setShowCreateModal(false);
      setNewEmail('');
      setMessage({ type: 'success', text: `Created user ${newEmail} (${newRole}) successfully!` });
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.detail || err.message || 'Failed to create user' });
    } finally {
      setCreating(false);
    }
  };

  const toggleUserStatus = async (user: UserItem) => {
    const nextState = !user.isActive;
    const action = nextState ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) return;

    setMessage(null);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextState }),
      });
      setMessage({ type: 'success', text: `User ${user.email} is now ${nextState ? 'active' : 'deactivated'}.` });
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.detail || err.message || `Failed to ${action} user` });
    }
  };

  return (
    <RoleGate roles={['ADMIN']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System User Directory</h1>
            <p className="text-slate-500 text-sm mt-1">Manage institutional staff, management delegates, and system administrators</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            + New System User
          </button>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Total Users: {total}</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading user directory...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Email Address</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Approver</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {u.email}
                          {isSelf && (
                            <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`badge ${
                              u.role === 'ADMIN'
                                ? 'badge-danger'
                                : u.role === 'MANAGEMENT'
                                ? 'badge-warning'
                                : u.role === 'STAFF'
                                ? 'badge-info'
                                : 'badge-secondary'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600">
                          {u.canApprove ? '✓ Yes' : 'No'}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`badge ${u.isActive ? 'badge-success' : 'badge-secondary'}`}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => toggleUserStatus(u)}
                            disabled={isSelf && u.isActive}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition disabled:opacity-40 ${
                              u.isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add System User</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@university.edu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="STAFF">Staff (Coordinator)</option>
                    <option value="MANAGEMENT">Management (Reporting)</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RoleGate>
  );
}
