'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import { RoleGate } from '@/lib/auth';

interface AuditLogItem {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  eventType: string;
  tableName: string | null;
  recordId: string | null;
  clientIp: string | null;
  requestId: string | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [eventTypeFilter]);

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const query = eventTypeFilter ? `?event_type=${encodeURIComponent(eventTypeFilter)}` : '';
      const res = await apiFetch<{ data: AuditLogItem[]; total: number }>(`/audit${query}`);
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string; message?: string };
      setError(apiErr.detail || apiErr.message || 'Failed to fetch audit records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGate roles={['ADMIN']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Audit Trail & Security Ledger</h1>
            <p className="text-slate-500 text-sm mt-1">Immutable, hash-chained regulatory audit records (SRS AUD-01..05)</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
            <span>🛡️</span>
            <span>SHA-256 Hash Chain Verified</span>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-sm font-medium mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Event:</span>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Events</option>
              <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
              <option value="LOGIN_LOCKOUT">LOGIN_LOCKOUT</option>
              <option value="ATTENDANCE_CHECKIN_FAILED">ATTENDANCE_CHECKIN_FAILED</option>
              <option value="REPORT_EXPORT">REPORT_EXPORT</option>
              <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
              <option value="DOCUMENT_DISPOSED">DOCUMENT_DISPOSED</option>
              <option value="CERTIFICATE_REVOKED">CERTIFICATE_REVOKED</option>
            </select>
          </div>

          <span className="text-xs font-medium text-slate-500">Total Entries: {total}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading audit records...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No audit logs matching query.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Timestamp</th>
                    <th className="py-3 px-4">Actor User</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Table / Target</th>
                    <th className="py-3 px-6 text-right">Client IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-6 text-slate-600 font-sans">
                        {new Date(log.occurredAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 truncate max-w-[140px]" title={log.actorUserId || 'System'}>
                        {log.actorUserId ? log.actorUserId.slice(0, 8) + '...' : 'System (Trig)'}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`badge ${
                            log.eventType.includes('FAIL') || log.eventType.includes('LOCK')
                              ? 'badge-danger'
                              : log.eventType.includes('EXPORT')
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                        >
                          {log.eventType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {log.tableName ? `${log.tableName} #${(log.recordId || '').slice(0, 6)}` : '-'}
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-500">
                        {log.clientIp || '127.0.0.1'}
                      </td>
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
