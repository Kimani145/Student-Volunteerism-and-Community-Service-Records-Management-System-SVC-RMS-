'use client';

import { useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { RoleGate } from '@/lib/auth';
import { Loading } from '@/components/ui/Loading';
import { Empty } from '@/components/ui/Empty';
import { ErrorState } from '@/components/ui/ErrorState';

interface ActivityReportRow {
  title: string;
  type: string;
  start_at: string;
  status: string;
  registered: number;
  attended: number;
  hours: number;
}

export default function StaffReportsPage() {
  const [exporting, setExporting] = useState(false);
  const { data: rawData, error, loading, retry } = useApi<ActivityReportRow[]>('/reports/activities');
  const activities = rawData || [];

  const downloadCsv = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/v1/reports/activities.csv', {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activities_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <RoleGate roles={['STAFF', 'MANAGEMENT', 'ADMIN']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Activities Report</h1>
            <p className="text-slate-500 text-sm mt-1">Aggregated statistics, attendance counts, and accredited hours</p>
          </div>
          <button
            onClick={downloadCsv}
            disabled={exporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            <span>📥</span>
            <span>{exporting ? 'Exporting CSV...' : 'Download CSV Report'}</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <Loading message="Loading reports..." />
          ) : error ? (
            <ErrorState error={error} onRetry={retry} />
          ) : activities.length === 0 ? (
            <Empty message="No activity data recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Activity Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Registered</th>
                    <th className="py-3 px-4 text-center">Attended</th>
                    <th className="py-3 px-6 text-right">Service Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900">{a.title}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">{a.type}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {new Date(a.start_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className="badge badge-info">{a.status}</span>
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-slate-700">{a.registered}</td>
                      <td className="py-4 px-4 text-center font-bold text-emerald-600">{a.attended}</td>
                      <td className="py-4 px-6 text-right font-extrabold text-indigo-600">{a.hours} hrs</td>
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
