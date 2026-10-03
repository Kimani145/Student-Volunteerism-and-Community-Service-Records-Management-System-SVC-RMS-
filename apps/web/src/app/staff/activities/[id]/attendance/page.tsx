'use client';

import { useState, useEffect } from 'react';

export default function CoordinatorAttendancePage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const [participations, setParticipations] = useState<any[]>([]);
  
  const fetchToken = async () => {
    try {
      const res = await fetch(`/api/v1/activities/${params.id}/check-in-token`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setValidUntil(data.validUntil);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchToken();
    const interval = setInterval(fetchToken, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleBulkUpdate = async (status: 'ATTENDED' | 'ABSENT') => {
    // A mock bulk update sending all participations
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Activity Attendance Console</h1>
      
      <div className="flex gap-8 mb-8">
        <div className="w-1/3 bg-white shadow rounded p-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold mb-2">Live QR Token</h2>
          {token ? (
            <div className="text-4xl font-mono tracking-widest text-blue-700 bg-blue-50 py-4 px-6 rounded-lg mb-2">
              {token}
            </div>
          ) : (
            <div className="animate-pulse bg-gray-200 w-48 h-16 rounded mb-2"></div>
          )}
          <p className="text-sm text-gray-500">Refreshes every 25 seconds</p>
          <div className="mt-4 p-4 border border-dashed border-gray-300">
             <div className="w-32 h-32 bg-gray-200">QR CODE</div>
          </div>
        </div>
        
        <div className="w-2/3 bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Manual Roster</h2>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-700 font-medium">Checked in: {participations.filter(p => p.status === 'ATTENDED').length}</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded text-sm" onClick={() => handleBulkUpdate('ATTENDED')}>Mark Selected Attended</button>
              <button className="px-3 py-1 bg-red-600 text-white rounded text-sm" onClick={() => handleBulkUpdate('ABSENT')}>Mark Selected Absent</button>
            </div>
          </div>
          
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left border-b">
                <th className="p-2 w-10"><input type="checkbox" /></th>
                <th className="p-2">Student</th>
                <th className="p-2">Status</th>
                <th className="p-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {participations.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No participants registered (mocked UI)</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
