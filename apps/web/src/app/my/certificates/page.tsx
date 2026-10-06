'use client';
import { apiFetch } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { RoleGate } from '@/lib/auth';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/api-states';

interface Certificate {
  id: string;
  cvid: string;
  issued_at: string;
  status: string;
  participations: {
    activities: {
      title: string;
    };
  };
}

export default function MyCertificatesPage() {
  const { data: certs, error, loading, retry } = useApi<Certificate[]>(() => apiFetch('/certificates/me'));

  return (
    <RoleGate roles={['STUDENT']}>
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-8">My Certificates</h1>
        
        {loading ? (
          <LoadingState message="Loading your certificates..." />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : !certs || certs.length === 0 ? (
          <EmptyState message="You have no certificates yet. Complete an activity to earn one." />
        ) : (
          <div className="grid gap-4">
            {certs.map(cert => (
              <div key={cert.id} className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{cert.participations.activities.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Issued: {new Date(cert.issued_at).toLocaleDateString()} &middot; CVID: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{cert.cvid}</span>
                  </p>
                  <div className="mt-3">
                    {cert.status === 'VALID' || cert.status === 'ISSUED' ? (
                      <span className="text-xs font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">VALID</span>
                    ) : (
                      <span className="text-xs font-bold tracking-wide uppercase bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full">REVOKED</span>
                    )}
                  </div>
                </div>
                <a
                  href={`/api/v1/certificates/${cert.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center justify-center bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-sm hover:bg-indigo-700 text-sm font-semibold transition"
                >
                  Download PDF
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </RoleGate>
  );
}
