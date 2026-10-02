'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';

interface ParticipationItem {
  id: string;
  status: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED';
  created_at: string;
  activities: {
    id: string;
    title: string;
    venue: string;
    start_at: string;
    end_at: string;
    service_hours: number;
    activity_types?: { name: string };
  };
  certificates?: {
    id: string;
    cvid: string;
    status: string;
  }[];
}

export default function MyHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<ParticipationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<ParticipationItem[]>('/students/me/history');
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;

  if (!user || user.role !== 'STUDENT') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Student Access Only</h2>
        <p className="text-slate-500 text-sm mb-6">Please sign in with a registered student account to view participation history.</p>
        <Link href="/login" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
          Sign In
        </Link>
      </div>
    );
  }

  const attendedItems = history.filter((h) => h.status === 'ATTENDED');
  const totalHours = attendedItems.reduce((sum, h) => sum + (h.activities?.service_hours || 0), 0);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Volunteer History</h1>
          <p className="text-slate-500 text-sm mt-1">Track your community service participation and accredited hours</p>
        </div>
        <Link
          href="/activities"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
          Explore More Activities
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Service Hours</span>
          <span className="text-3xl font-black text-indigo-600 mt-2 block">{totalHours} hrs</span>
          <span className="text-xs text-slate-400 mt-1 block">Accredited by coordinators</span>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Completed Activities</span>
          <span className="text-3xl font-black text-emerald-600 mt-2 block">{attendedItems.length}</span>
          <span className="text-xs text-slate-400 mt-1 block">Successfully attended</span>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Registrations</span>
          <span className="text-3xl font-black text-slate-700 mt-2 block">{history.length}</span>
          <span className="text-xs text-slate-400 mt-1 block">Lifetime student records</span>
        </div>
      </div>

      {/* Participation Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900">Enrolment & Attendance Records</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading participation records...</div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <h3 className="font-bold text-slate-800 text-base">No volunteering records yet</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6">Discover student-led initiatives and start giving back to the community.</p>
            <Link href="/activities" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
              Browse Activities
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Activity</th>
                  <th className="py-3 px-4">Date & Venue</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Hours</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => {
                  const act = item.activities;
                  const startDate = new Date(act.start_at);

                  const statusClass =
                    item.status === 'ATTENDED'
                      ? 'badge-success'
                      : item.status === 'REGISTERED'
                      ? 'badge-info'
                      : item.status === 'ABSENT'
                      ? 'badge-danger'
                      : 'badge-secondary';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <Link href={`/activities/${act.id}`} className="hover:text-indigo-600 transition">
                          {act.title}
                        </Link>
                        {act.activity_types && (
                          <div className="text-xs text-slate-400 mt-0.5">{act.activity_types.name}</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600 text-xs">
                        <div>{startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-slate-400">{act.venue}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`badge ${statusClass}`}>{item.status}</span>
                      </td>
                      <td className="py-4 px-4 text-center font-semibold text-slate-800">
                        {item.status === 'ATTENDED' ? act.service_hours : 0}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {item.status === 'ATTENDED' ? (
                          <Link
                            href="/my/certificates"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            View Certificate &rarr;
                          </Link>
                        ) : item.status === 'REGISTERED' ? (
                          <Link
                            href={`/check-in?activity=${act.id}`}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                          >
                            Check In &rarr;
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
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
    </div>
  );
}
