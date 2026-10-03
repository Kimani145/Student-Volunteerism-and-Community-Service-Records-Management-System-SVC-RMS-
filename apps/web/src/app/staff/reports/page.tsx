'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function StaffReports() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<any[]>('/reports/activities').then(setActivities).catch(console.error);
  }, []);

  const downloadCsv = () => {
    // In production we need auth token, but browser will send cookies if using fastify cookie
    window.location.href = '/api/v1/reports/activities.csv';
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Activity Reports</h1>
      <button onClick={downloadCsv} className="mb-4 p-2 bg-blue-500 text-white rounded">Download CSV</button>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">Title</th>
            <th className="border p-2">Type</th>
            <th className="border p-2">Dates</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Registered</th>
            <th className="border p-2">Attended</th>
            <th className="border p-2">Hours</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a, i) => (
            <tr key={i}>
              <td className="border p-2">{a.title}</td>
              <td className="border p-2">{a.type}</td>
              <td className="border p-2">{new Date(a.start_at).toLocaleDateString()}</td>
              <td className="border p-2">{a.status}</td>
              <td className="border p-2">{a.registered}</td>
              <td className="border p-2">{a.attended}</td>
              <td className="border p-2">{a.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
