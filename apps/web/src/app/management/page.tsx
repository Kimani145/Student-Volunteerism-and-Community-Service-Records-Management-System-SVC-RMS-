'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { RoleGate } from '@/lib/auth';

interface DashboardRow {
  month: string;
  activityType: string;
  schoolId: number;
  yearOfStudy: number;
  activities: number;
  participants: number;
  attendedCount: number;
  totalHours: number;
}

export default function ManagementDashboardPage() {
  const [data, setData] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const rows = await apiFetch<DashboardRow[]>('/reports/dashboard');
      setData(rows || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const totalActivities = data.reduce((sum, r) => sum + (Number(r.activities) || 0), 0);
  const totalRegistrations = data.reduce((sum, r) => sum + (Number(r.participants) || 0), 0);
  const totalAttended = data.reduce((sum, r) => sum + (Number(r.attendedCount) || 0), 0);
  const totalHours = data.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0);

  return (
    <RoleGate roles={['MANAGEMENT', 'ADMIN', 'STAFF']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Institutional Impact Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">High-level strategic volunteerism metrics and school aggregations</p>
          </div>
          <Link
            href="/staff/reports"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            Detailed Reports &rarr;
          </Link>
        </div>

        {/* Strategic KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Service Hours Delivered</span>
            <span className="text-3xl font-black text-indigo-600 mt-2 block">{totalHours.toLocaleString()} hrs</span>
            <span className="text-xs text-slate-500 mt-1 block">Accredited student community impact</span>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Completed Participations</span>
            <span className="text-3xl font-black text-emerald-600 mt-2 block">{totalAttended.toLocaleString()}</span>
            <span className="text-xs text-slate-500 mt-1 block">Verified on-site check-ins</span>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Registrations</span>
            <span className="text-3xl font-black text-slate-800 mt-2 block">{totalRegistrations.toLocaleString()}</span>
            <span className="text-xs text-slate-500 mt-1 block">Student sign-ups across all initiatives</span>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Activities Conducted</span>
            <span className="text-3xl font-black text-amber-600 mt-2 block">{totalActivities.toLocaleString()}</span>
            <span className="text-xs text-slate-500 mt-1 block">Events with verified outcomes</span>
          </div>
        </div>

        {/* Aggregated Breakdown Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">Monthly Aggregations by School & Type</h2>
            <span className="text-xs text-slate-400">Database-aggregated (No raw PII exposure)</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading metrics...</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No aggregation data available yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Month</th>
                    <th className="py-3 px-4">Activity Category</th>
                    <th className="py-3 px-4">School ID</th>
                    <th className="py-3 px-4">Year</th>
                    <th className="py-3 px-4 text-center">Activities</th>
                    <th className="py-3 px-4 text-center">Registrations</th>
                    <th className="py-3 px-4 text-center">Attended</th>
                    <th className="py-3 px-6 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900">{row.month || 'Current'}</td>
                      <td className="py-4 px-4">
                        <span className="badge badge-info">{row.activityType || 'Initiative'}</span>
                      </td>
                      <td className="py-4 px-4 text-slate-700 text-xs">School #{row.schoolId}</td>
                      <td className="py-4 px-4 text-slate-700 text-xs">Year {row.yearOfStudy}</td>
                      <td className="py-4 px-4 text-center font-medium text-slate-800">{row.activities}</td>
                      <td className="py-4 px-4 text-center font-medium text-slate-800">{row.participants}</td>
                      <td className="py-4 px-4 text-center font-bold text-emerald-600">{row.attendedCount}</td>
                      <td className="py-4 px-6 text-right font-extrabold text-indigo-600">{row.totalHours} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RoleGate>
  );
}
