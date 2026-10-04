'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';

interface RegisteredActivity {
  id: string;
  activity_id: string;
  status: string;
  activities: {
    id: string;
    title: string;
    venue: string;
    service_hours: number;
    start_at: string;
    end_at: string;
  };
}

export default function CheckInPage() {
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState('');
  const [activityId, setActivityId] = useState('');
  const [registeredActivities, setRegisteredActivities] = useState<RegisteredActivity[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [awardedHours, setAwardedHours] = useState<number | null>(null);

  const { data: rawHistory, error, loading, retry } = useApi<RegisteredActivity[]>('/students/me/history');
  
  useEffect(() => {
    // Check URL search params for ?activity=
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const actParam = urlParams.get('activity');
      if (actParam) {
        setActivityId(actParam);
      }
    }
  }, []);

  useEffect(() => {
    if (rawHistory) {
      const active = rawHistory.filter((r) => r.status === 'REGISTERED');
      setRegisteredActivities(active);
      if (active.length > 0 && !activityId) {
        setActivityId(active[0]!.activity_id);
      }
    }
  }, [rawHistory, activityId]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityId) {
      setStatus('error');
      setMessage('Please select or specify the activity you are checking in for.');
      return;
    }
    if (token.length !== 10) {
      setStatus('error');
      setMessage('Attendance code must be exactly 10 characters.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setAwardedHours(null);

    try {
      const res = await apiFetch<Record<string, unknown>>(`/activities/${activityId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ token: token.toUpperCase() }),
      });

      setStatus('success');
      setMessage('Attendance successfully verified and credited!');
      const hours = (res.hoursAwarded as number) || (res.serviceHours as number);
      if (hours) {
        setAwardedHours(hours);
      }
      setToken('');
    } catch (err: unknown) {
      const apiErr = err as { detail?: string; message?: string };
      setStatus('error');
      setMessage(apiErr.detail || apiErr.message || 'Check-in failed. Please verify the code or check with your coordinator.');
    }
  };

  if (authLoading) {
    return <div className="p-8 text-center text-slate-500">Loading terminal...</div>;
  }

  if (!user || user.role !== 'STUDENT') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Student Check-In Required</h2>
        <p className="text-slate-500 text-sm mb-6">Please log in with your student credentials to submit an attendance verification code.</p>
        <Link href="/login?redirect=/check-in" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            ⚡
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Activity Check-In</h1>
          <p className="text-xs text-slate-500 mt-1">Submit the on-screen code from your activity coordinator</p>
        </div>

        <form onSubmit={handleCheckIn} className="space-y-5">
          {/* Activity selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Activity
            </label>
            {registeredActivities.length > 0 ? (
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                {registeredActivities.map((reg) => (
                  <option key={reg.activity_id} value={reg.activity_id}>
                    {reg.activities.title} ({reg.activities.service_hours} hrs)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Enter Activity ID UUID..."
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            )}
            <span className="text-[11px] text-slate-400 mt-1 block">
              {registeredActivities.length > 0
                ? `${registeredActivities.length} registered activities ready for attendance`
                : 'Or specify the activity identifier from your confirmation email'}
            </span>
          </div>

          {/* 10-char code input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              10-Character Attendance Code
            </label>
            <input
              type="text"
              maxLength={10}
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              placeholder="e.g. 9B2X8K4M1P"
              className="w-full border-2 border-slate-300 focus:border-indigo-600 rounded-xl p-3 text-center text-2xl font-mono uppercase tracking-[0.25em] font-extrabold focus:outline-none transition shadow-sm"
              required
            />
            <span className="text-[11px] text-slate-400 mt-1.5 text-center block">
              Codes rotate periodically. Previous window accepted for 30s grace.
            </span>
          </div>

          <button
            type="submit"
            disabled={status === 'loading' || token.length !== 10 || !activityId}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition text-sm flex items-center justify-center gap-2"
          >
            {status === 'loading' ? 'Verifying with coordinator...' : 'Verify & Record Attendance'}
          </button>
        </form>

        {/* Feedback message */}
        {message && (
          <div
            className={`mt-6 p-4 rounded-xl text-center text-sm font-medium ${
              status === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div>{message}</div>
            {status === 'success' && (
              <div className="mt-3">
                <Link
                  href="/my/history"
                  className="inline-block px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                >
                  View Updated Service History &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
