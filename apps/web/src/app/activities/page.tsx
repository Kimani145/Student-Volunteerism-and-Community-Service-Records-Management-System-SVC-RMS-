'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/api-states';

interface Activity {
  id: string;
  title: string;
  description: string;
  venue: string;
  start_at: string;
  end_at: string;
  capacity: number;
  service_hours: number;
  status: string;
  eligible_years: number[];
  activity_types?: { id: number; code: string; name: string };
}

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (selectedType) params.set('type', selectedType);
  const searchUrl = `/activities?${params.toString()}`;

  const { data, error, loading, retry } = useApi<{ items: Activity[]; total: number }>(searchUrl);
  const activities = data?.items || [];

  useEffect(() => {
    if (data?.items && types.length === 0) {
      const uniqueTypes = Array.from(
        new Set(data.items.map((a) => a.activity_types?.name).filter(Boolean) as string[])
      );
      if (uniqueTypes.length > 0) {
        setTypes(uniqueTypes);
      }
    }
  }, [data, types.length]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Community Activities</h1>
          <p className="text-slate-500 text-sm mt-1">Discover and sign up for student volunteer opportunities</p>
        </div>

        {user?.role === 'STAFF' && (
          <Link
            href="/staff/activities"
            className="self-start md:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
          >
            + Staff Console
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-8 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, description, or venue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="sm:w-60">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Activity Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Activity Grid */}
      {loading ? (
        <LoadingState message="Loading activities..." />
      ) : error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : activities.length === 0 ? (
        <EmptyState message="No activities found." actionText="Clear Filters" onAction={() => { setSearch(''); setSelectedType(''); }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((act) => {
            const startDate = new Date(act.start_at);
            const endDate = new Date(act.end_at);
            const isUpcoming = startDate > new Date();

            return (
              <div
                key={act.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden group"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="badge badge-info">
                      {act.activity_types?.name || 'Volunteer'}
                    </span>
                    <span className={`badge ${act.status === 'PUBLISHED' ? 'badge-success' : 'badge-secondary'}`}>
                      {act.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition mb-2">
                    {act.title}
                  </h3>

                  <p className="text-slate-600 text-sm line-clamp-2 mb-4 flex-1">
                    {act.description}
                  </p>

                  <div className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span className="truncate">{act.venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>
                        {startDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })} • {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span className="font-semibold text-slate-700">{act.service_hours} Service Hours</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>👥</span>
                      <span>Capacity: {act.capacity} participants</span>
                    </div>
                  </div>

                  <Link
                    href={`/activities/${act.id}`}
                    className="w-full text-center py-2 px-4 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-medium text-sm transition"
                  >
                    View Details & Register &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
