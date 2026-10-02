'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    apiFetch<any[]>('/notifications').then(setNotifications).catch(console.error);
  };

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    load();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Notifications</h1>
      <ul className="space-y-4">
        {notifications.map((n, i) => (
          <li key={i} className={`p-4 border rounded ${n.read_at ? 'bg-gray-100' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold">{n.title}</h2>
                <p>{n.body}</p>
                <p className="text-sm text-gray-500">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.read_at && (
                <button onClick={() => markRead(n.id)} className="text-blue-500 text-sm">
                  Mark as Read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
