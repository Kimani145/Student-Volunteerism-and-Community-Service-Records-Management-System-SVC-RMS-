'use client';

import { useState } from 'react';

export default function CheckInPage() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleCheckIn = async (code: string) => {
    setStatus('loading');
    setMessage('');
    try {
      const location = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({})
        );
      });

      // We extract activityId if we had it in URL, but the spec says the user just goes to /check-in.
      // Wait, if the token encodes the activityId, we don't have it upfront. 
      // Actually ATT-02 says: POST /activities/:id/check-in {token, lat?, lng?}
      // How does the app know the activityId on `/check-in`?
      // Usually the QR code contains a URL like `/check-in?activity=...` or `/check-in/[activityId]`.
      // Let's assume it's passed as a query param `?activity=id` or they need to select it.
      const urlParams = new URLSearchParams(window.location.search);
      const activityId = urlParams.get('activity');
      
      if (!activityId) {
        setStatus('error');
        setMessage('No activity specified in URL');
        return;
      }

      const res = await fetch(`/api/v1/activities/${activityId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // assuming simple auth for mock
        },
        body: JSON.stringify({ token: code, lat: location.lat, lng: location.lng })
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Checked in successfully!');
      } else {
        setStatus('error');
        setMessage(data.detail || data.message || 'Failed to check in');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="w-full max-w-[360px] mx-auto p-4 flex flex-col items-center">
      <h1 className="text-xl font-bold mb-4">Activity Check-In</h1>
      
      {/* Fake QR Scanner Box */}
      <div className="w-64 h-64 bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center mb-6">
        <span className="text-gray-500 text-sm">QR Scanner (Camera)</span>
      </div>

      <div className="w-full">
        <p className="text-sm font-semibold mb-2">Or enter the 10-character code:</p>
        <div className="flex flex-col gap-3">
          <input 
            type="text" 
            maxLength={10} 
            value={token} 
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            placeholder="e.g. ABCDEF1234"
            className="w-full border border-gray-300 rounded p-2 text-center text-lg uppercase tracking-widest"
          />
          <button 
            onClick={() => handleCheckIn(token)}
            disabled={status === 'loading' || token.length !== 10}
            className="w-full bg-blue-600 text-white rounded py-2 font-medium disabled:opacity-50"
          >
            {status === 'loading' ? 'Checking in...' : 'Submit Code'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mt-4 p-3 w-full rounded text-center ${status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
