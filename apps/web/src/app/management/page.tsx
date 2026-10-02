'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function ManagementDashboard() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<any[]>('/reports/dashboard').then(setData).catch(console.error);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Management Dashboard</h1>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">Month</th>
            <th className="border p-2">Activity Type</th>
            <th className="border p-2">School</th>
            <th className="border p-2">Year of Study</th>
            <th className="border p-2">Activities</th>
            <th className="border p-2">Participants</th>
            <th className="border p-2">Attended</th>
            <th className="border p-2">Total Hours</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="border p-2">{row.month}</td>
              <td className="border p-2">{row.activityType}</td>
              <td className="border p-2">{row.schoolId}</td>
              <td className="border p-2">{row.yearOfStudy}</td>
              <td className="border p-2">{row.activities}</td>
              <td className="border p-2">{row.participants}</td>
              <td className="border p-2">{row.attendedCount}</td>
              <td className="border p-2">{row.totalHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
