'use client';
import { apiFetch } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { RoleGate } from '@/lib/auth';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/api-states';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export default function NotificationsPage() {
  const { data: notifications, error, loading, retry } = useApi<AppNotification[]>(() => apiFetch('/notifications'));

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      retry();
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to mark notification as read');
    }
  };

  return (
    <RoleGate roles={['STUDENT', 'STAFF', 'MANAGEMENT', 'ADMIN']}>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-8">Notifications</h1>

        {loading ? (
          <LoadingState message="Loading notifications..." />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : !notifications || notifications.length === 0 ? (
          <EmptyState message="You have no notifications." />
        ) : (
          <ul className="space-y-4">
            {notifications.map((n) => (
              <li key={n.id} className={`p-5 border rounded-xl shadow-sm ${n.read_at ? 'bg-slate-50 border-slate-100' : 'bg-white border-indigo-100'}`}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className={`font-bold ${n.read_at ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</h2>
                    <p className={`mt-1 text-sm ${n.read_at ? 'text-slate-500' : 'text-slate-700'}`}>{n.body}</p>
                    <p className="mt-3 text-xs text-slate-400 font-medium">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.read_at && (
                    <button 
                      onClick={() => markRead(n.id)} 
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RoleGate>
  );
}
