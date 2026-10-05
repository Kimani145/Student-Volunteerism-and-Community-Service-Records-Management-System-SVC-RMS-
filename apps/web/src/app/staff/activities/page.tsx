'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { useAuth, RoleGate } from '@/lib/auth';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/api-states';

interface StaffActivity {
  id: string;
  title: string;
  venue: string;
  start_at: string;
  end_at: string;
  capacity: number;
  service_hours: number;
  status: string;
  organizer_id: string;
  activity_types?: { name: string };
}

export default function StaffActivitiesPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New activity form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newTypeId, setNewTypeId] = useState(1);
  const [newHours, setNewHours] = useState(4);
  const [newCapacity, setNewCapacity] = useState(50);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newRegClose, setNewRegClose] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, error, loading, retry } = useApi<{ items: StaffActivity[]; total: number }>(`/activities${statusFilter ? `?status=${statusFilter}` : ''}`);
  const activities = data?.items || [];
  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setActionMsg(null);
    try {
      await apiFetch('/activities', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          venue: newVenue,
          typeId: Number(newTypeId),
          serviceHours: Number(newHours),
          capacity: Number(newCapacity),
          startAt: new Date(newStart).toISOString(),
          endAt: new Date(newEnd).toISOString(),
          registrationClosesAt: new Date(newRegClose).toISOString(),
          eligibleYears: [1, 2, 3, 4],
        }),
      });

      setShowCreateModal(false);
      setActionMsg({ type: 'success', text: 'Activity successfully drafted!' });
      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewVenue('');
      retry();
    } catch (err: unknown) {
      const apiErr = err as any;
      setActionMsg({ type: 'error', text: apiErr.detail || apiErr.message || 'Failed to create activity' });
    } finally {
      setCreating(false);
    }
  };

  const handleTransition = async (id: string, nextStatus: string) => {
    try {
      setActionMsg(null);
      await apiFetch(`/activities/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      setActionMsg({ type: 'success', text: `Activity moved to ${nextStatus}!` });
      retry();
    } catch (err: unknown) {
      const apiErr = err as any;
      setActionMsg({
        type: 'error',
        text: apiErr.detail || apiErr.message || `Failed to transition activity to ${nextStatus}`,
      });
    }
  };

  return (
    <RoleGate roles={['STAFF', 'ADMIN']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Activities Management Console</h1>
            <p className="text-slate-500 text-sm mt-1">Create initiatives, review approvals, and monitor on-site sessions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            + New Activity
          </button>
        </div>

        {actionMsg && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-medium ${
              actionMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['', 'DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st || 'ALL STATUSES'}
            </button>
          ))}
        </div>

        {/* Activities Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <LoadingState message="Loading activities..." />
          ) : error ? (
            <ErrorState error={error} onRetry={retry} />
          ) : activities.length === 0 ? (
            <EmptyState title="No activities found" message="No activities found in this view." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Title</th>
                    <th className="py-3 px-4">Venue & Time</th>
                    <th className="py-3 px-4">Capacity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((act) => {
                    const start = new Date(act.start_at);
                    const canPublish = act.status === 'DRAFT' && user?.id !== act.organizer_id;

                    return (
                      <tr key={act.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {act.title}
                          <div className="text-xs font-normal text-slate-400">
                            {act.activity_types?.name} • {act.service_hours} hrs
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600">
                          <div>{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                          <div className="text-slate-400">{act.venue}</div>
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-slate-700">
                          {act.capacity} spots
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`badge ${
                              act.status === 'PUBLISHED'
                                ? 'badge-success'
                                : act.status === 'IN_PROGRESS'
                                ? 'badge-warning'
                                : act.status === 'DRAFT'
                                ? 'badge-secondary'
                                : 'badge-info'
                            }`}
                          >
                            {act.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          {canPublish && (
                            <button
                              onClick={() => handleTransition(act.id, 'PUBLISHED')}
                              className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition"
                            >
                              Approve & Publish
                            </button>
                          )}
                          {act.status === 'PUBLISHED' && (
                            <button
                              onClick={() => handleTransition(act.id, 'IN_PROGRESS')}
                              className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded font-medium transition"
                            >
                              Start Activity
                            </button>
                          )}
                          {(act.status === 'PUBLISHED' || act.status === 'IN_PROGRESS') && (
                            <Link
                              href={`/staff/activities/${act.id}/attendance`}
                              className="inline-block px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition"
                            >
                              Attendance Console &rarr;
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Activity Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Create New Activity</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateActivity} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. City Park Tree Planting"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    required
                    rows={3}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Objective, instructions, equipment needed..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Venue</label>
                    <input
                      type="text"
                      required
                      value={newVenue}
                      onChange={(e) => setNewVenue(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder="e.g. Campus Amphitheater"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Type</label>
                    <select
                      value={newTypeId}
                      onChange={(e) => setNewTypeId(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value={1}>Tree Planting</option>
                      <option value={2}>Fundraising</option>
                      <option value={3}>Cleanup</option>
                      <option value={4}>Donation</option>
                      <option value={5}>Mentorship</option>
                      <option value={6}>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Service Hours</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newHours}
                      onChange={(e) => setNewHours(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Closes</label>
                    <input
                      type="datetime-local"
                      required
                      value={newRegClose}
                      onChange={(e) => setNewRegClose(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
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
                    {creating ? 'Creating...' : 'Create Activity'}
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
