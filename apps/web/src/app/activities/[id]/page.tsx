'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';

interface ActivityDetail {
  id: string;
  title: string;
  description: string;
  venue: string;
  start_at: string;
  end_at: string;
  registration_closes_at: string;
  capacity: number;
  service_hours: number;
  status: string;
  eligible_years: number[];
  activity_types?: { id: number; name: string };
  community_partners?: { id: string; name: string };
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (id) {
      loadActivity();
      if (user?.role === 'STUDENT') {
        checkRegistration();
      }
    }
  }, [id, user]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<ActivityDetail>(`/activities/${id}`);
      setActivity(data);
    } catch (err: unknown) {
      setError(err.message || 'Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  const checkRegistration = async () => {
    try {
      const history = await apiFetch<Record<string, unknown>[]>('/students/me/history');
      const found = history.find(
        (h) => h.activity_id === id && (h.status === 'REGISTERED' || h.status === 'ATTENDED')
      );
      setIsRegistered(!!found);
    } catch (err) {
      // ignore
    }
  };

  const handleRegister = async () => {
    try {
      setActionLoading(true);
      setActionMsg(null);
      await apiFetch(`/activities/${id}/registrations`, { method: 'POST' });
      setIsRegistered(true);
      setActionMsg({ type: 'success', text: 'You have successfully registered for this activity!' });
    } catch (err: unknown) {
      setActionMsg({
        type: 'error',
        text: err.detail || err.message || 'Registration failed. Check eligibility or schedule conflicts.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your registration?')) return;
    try {
      setActionLoading(true);
      setActionMsg(null);
      await apiFetch(`/activities/${id}/registrations/me`, { method: 'DELETE' });
      setIsRegistered(false);
      setActionMsg({ type: 'success', text: 'Your registration has been cancelled.' });
    } catch (err: unknown) {
      setActionMsg({
        type: 'error',
        text: err.detail || err.message || 'Cancellation failed. You cannot cancel after the start time.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800">Activity Not Available</h2>
        <p className="text-slate-500 text-sm mt-2">{error || 'Could not find the requested activity.'}</p>
        <Link
          href="/activities"
          className="inline-block mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
        >
          &larr; Back to Activities
        </Link>
      </div>
    );
  }

  const startDate = new Date(activity.start_at);
  const endDate = new Date(activity.end_at);
  const regClose = new Date(activity.registration_closes_at);
  const isRegOpen = new Date() < regClose && activity.status === 'PUBLISHED';
  const isInProgress = activity.status === 'IN_PROGRESS';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <Link href="/activities" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6">
        &larr; Back to all activities
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Banner header */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-8">
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="badge badge-info bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              {activity.activity_types?.name || 'Initiative'}
            </span>
            <span className="badge badge-success bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              {activity.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">{activity.title}</h1>
          <p className="text-slate-300 text-sm flex items-center gap-2">
            <span>📍 {activity.venue}</span>
            {activity.community_partners && (
              <span>• Partner: {activity.community_partners.name}</span>
            )}
          </p>
        </div>

        {/* Content body */}
        <div className="p-6 sm:p-8">
          {actionMsg && (
            <div
              className={`p-4 rounded-xl mb-6 text-sm font-medium ${
                actionMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {actionMsg.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Description & Objectives</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                  {activity.description}
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Student Eligibility</h3>
                <p className="text-slate-600 text-sm">
                  {activity.eligible_years && activity.eligible_years.length > 0 ? (
                    <>Open to years: <span className="font-semibold text-slate-800">{activity.eligible_years.join(', ')}</span></>
                  ) : (
                    'Open to all undergraduate & postgraduate academic years'
                  )}
                </p>
              </div>
            </div>

            {/* Sidebar Details Card */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 space-y-4">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Activity Overview</h4>

              <div>
                <span className="text-xs text-slate-500 block">Service Hours Awarded</span>
                <span className="text-xl font-extrabold text-indigo-600">{activity.service_hours} Hours</span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">Date & Time</span>
                <span className="text-sm font-semibold text-slate-800 block">
                  {startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-xs text-slate-600">
                  {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">Registration Closes</span>
                <span className="text-xs font-medium text-slate-700">
                  {regClose.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">Capacity</span>
                <span className="text-sm font-medium text-slate-800">{activity.capacity} Participants</span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-200">
                {!user ? (
                  <Link
                    href={`/login?redirect=/activities/${activity.id}`}
                    className="w-full block text-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition"
                  >
                    Sign In to Register
                  </Link>
                ) : user.role === 'STUDENT' ? (
                  isRegistered ? (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                        <span className="text-xs font-bold text-emerald-800">✓ You are registered</span>
                      </div>
                      {isInProgress && (
                        <Link
                          href={`/check-in?activity=${activity.id}`}
                          className="w-full block text-center py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition"
                        >
                          Check In Now &rarr;
                        </Link>
                      )}
                      <button
                        onClick={handleCancel}
                        disabled={actionLoading}
                        className="w-full py-2 px-4 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-medium text-xs transition"
                      >
                        {actionLoading ? 'Processing...' : 'Cancel Registration'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleRegister}
                      disabled={actionLoading || !isRegOpen}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition shadow-sm"
                    >
                      {actionLoading ? 'Registering...' : !isRegOpen ? 'Registration Closed' : 'Register for Activity'}
                    </button>
                  )
                ) : user.role === 'STAFF' ? (
                  <Link
                    href={`/staff/activities/${activity.id}/attendance`}
                    className="w-full block text-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition"
                  >
                    Open Live Attendance Console &rarr;
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
