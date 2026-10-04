'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { apiFetch } from '@/lib/api-client';
import { RoleGate } from '@/lib/auth';
import { Loading } from '@/components/ui/Loading';
import { Empty } from '@/components/ui/Empty';

interface AttendanceTokenResponse {
  token: string;
  validUntil: number;
}

interface Participant {
  id: string;
  status: string;
  students: {
    id: string;
    full_name: string;
    reg_number: string;
  };
  attendances?: {
    method: string;
    recorded_at: string;
  };
}

export default function CoordinatorAttendancePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [token, setToken] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [roster, setRoster] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(25);
  const [completing, setCompleting] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTokenAndRoster = async () => {
    if (!id) return;
    try {
      // 1. Fetch live check-in token
      const tokenRes = await apiFetch<AttendanceTokenResponse>(`/activities/${id}/check-in-token`);
      if (tokenRes?.token) {
        setToken(tokenRes.token);
        setValidUntil(tokenRes.validUntil);
        setTimeLeft(25);

        // Generate QR code data URL
        const checkInUrl = `${window.location.origin}/check-in?activity=${id}&code=${tokenRes.token}`;
        const url = await QRCode.toDataURL(checkInUrl, {
          width: 256,
          margin: 1,
          color: { dark: '#1e1b4b', light: '#ffffff' },
        });
        setQrDataUrl(url);
      }

      // 2. Fetch live roster
      const rosterRes = await apiFetch<Participant[]>(`/activities/${id}/roster`);
      setRoster(rosterRes || []);
    } catch (e: unknown) {
      const err = e as any;
      setStatusMsg({ type: 'error', text: err.detail || err.message || 'Failed to fetch attendance token or roster' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    // Load activity details
    apiFetch<Record<string, unknown>>(`/activities/${id}`)
      .then((act) => setActivityTitle(act.title))
      .catch(() => {});

    fetchTokenAndRoster();
    const interval = setInterval(fetchTokenAndRoster, 25000);

    const countdown = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 25));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [id]);

  const handleCompleteActivity = async () => {
    if (!confirm('Are you sure you want to complete this activity? Remaining registered participants will automatically be marked ABSENT.')) {
      return;
    }
    try {
      setCompleting(true);
      setStatusMsg(null);
      await apiFetch(`/activities/${id}/complete`, {
        method: 'POST',
      });
      setStatusMsg({
        type: 'success',
        text: 'Activity marked as COMPLETED. Remaining participants marked ABSENT.',
      });
      fetchTokenAndRoster();
    } catch (err: unknown) {
      setStatusMsg({
        type: 'error',
        text: err.detail || err.message || 'Failed to complete activity',
      });
    } finally {
      setCompleting(false);
    }
  };

  const attendedCount = roster.filter((p) => p.status === 'ATTENDED').length;

  return (
    <RoleGate roles={['STAFF', 'ADMIN']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link href="/staff/activities" className="text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1 inline-block">
              &larr; Back to Activities
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Live Attendance Terminal
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">{activityTitle || `Activity #${id}`}</p>
          </div>

          <button
            onClick={handleCompleteActivity}
            disabled={completing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {completing ? 'Completing...' : '✓ Complete Activity & Mark Absent'}
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-medium ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Live Token & QR Display */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
              Active Check-In Token
            </span>
            <p className="text-xs text-slate-400 mb-6">Display this code or QR on-site for participants</p>

            {token ? (
              <div className="w-full">
                <div className="bg-slate-900 text-amber-400 font-mono text-3xl sm:text-4xl tracking-[0.2em] font-black py-4 px-6 rounded-2xl shadow-inner mb-4 select-all">
                  {token}
                </div>

                {qrDataUrl && (
                  <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl inline-block shadow-sm mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Live QR Code" className="w-48 h-48 sm:w-56 sm:h-56 mx-auto" />
                  </div>
                )}

                {/* Countdown Timer bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(timeLeft / 25) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Rotating in <span className="text-indigo-600 font-bold">{timeLeft}s</span> (30s grace window)
                </div>
              </div>
            ) : (
              <div className="py-16">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span className="text-xs text-slate-400">Generating secure HMAC token...</span>
              </div>
            )}
          </div>

          {/* Right Column: Live Roster & Attendance Stream */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Enrolled Participants</h2>
                <p className="text-xs text-slate-500">Real-time check-in stream</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                  {attendedCount} / {roster.length} Attended
                </div>
                <button
                  onClick={fetchTokenAndRoster}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {loading ? (
                <Loading message="Loading roster..." />
              ) : roster.length === 0 ? (
                <Empty message="No students registered yet." />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-6">Student Name</th>
                      <th className="py-3 px-4">Reg Number</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.map((part) => (
                      <tr key={part.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {part.students?.full_name || 'Student'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {part.students?.reg_number || '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`badge ${
                              part.status === 'ATTENDED'
                                ? 'badge-success'
                                : part.status === 'REGISTERED'
                                ? 'badge-info'
                                : 'badge-danger'
                            }`}
                          >
                            {part.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                          {part.status === 'ATTENDED' ? 'QR / Code' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
