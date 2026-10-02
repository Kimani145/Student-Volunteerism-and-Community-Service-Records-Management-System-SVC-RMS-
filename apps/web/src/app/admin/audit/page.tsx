'use client';
import { useState, useEffect } from 'react';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/audit')
      .then(res => res.json())
      .then(data => {
        setLogs(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4">Loading audit logs...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Audit Logs</h1>
      {logs.length === 0 ? (
        <p>No audit logs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2">Time</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Event</th>
                <th className="p-2">Table</th>
                <th className="p-2">Record ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-b">
                  <td className="p-2">{new Date(log.occurredAt).toLocaleString()}</td>
                  <td className="p-2">{log.actorUserId || 'System'}</td>
                  <td className="p-2">{log.eventType}</td>
                  <td className="p-2">{log.tableName || '-'}</td>
                  <td className="p-2">{log.recordId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
