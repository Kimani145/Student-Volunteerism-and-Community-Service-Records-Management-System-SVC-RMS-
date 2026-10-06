'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { RoleGate } from '@/lib/auth';

interface CertificateDetails {
  id: string;
  status: string;
  cvid: string;
  issued_at: string;
  participations?: {
    students?: {
      full_name?: string;
    };
    activities?: {
      title?: string;
    };
  };
}

export default function StaffCertificatesPage() {
  const [certId, setCertId] = useState('');
  const [cert, setCert] = useState<CertificateDetails | null>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setActionSuccess('');
    try {
      const data = await apiFetch<CertificateDetails>(`/certificates/${certId}`);
      setCert(data);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Failed to fetch certificate');
      setCert(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!reason) return alert('Revocation reason is required');
    if (!cert) return;
    try {
      await apiFetch(`/certificates/${cert.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setActionSuccess('Certificate revoked successfully');
      setCert((prev) => (prev ? { ...prev, status: 'REVOKED' } : null));
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      alert(apiErr.message || 'Failed to revoke certificate');
    }
  };

  const handleReissue = async () => {
    try {
      const newCert = await apiFetch<CertificateDetails>(`/certificates/${cert!.id}/reissue`, {
        method: 'POST',
      });
      setActionSuccess(`Certificate reissued successfully! New CVID: ${newCert.cvid}`);
      setCertId(newCert.id);
      setCert(newCert);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      alert(apiErr.message || 'Failed to reissue certificate');
    }
  };

  return (
    <RoleGate roles={['STAFF', 'ADMIN']}>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Staff Certificate Management</h1>
        <p className="text-slate-500 text-sm mb-8">Inspect issued credentials, manage revocations, and issue reissuances</p>

        <form onSubmit={fetchCert} className="mb-8 flex gap-3">
          <input
            type="text"
            placeholder="Enter Certificate UUID or CVID..."
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Lookup'}
          </button>
        </form>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-sm font-medium mb-6">
            {error}
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-medium mb-6">
            {actionSuccess}
          </div>
        )}

        {cert && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Certificate Credential Details</h2>
                <span className="text-xs text-slate-400 font-mono">ID: {cert.id}</span>
              </div>
              <span
                className={`badge ${
                  cert.status === 'VALID' || cert.status === 'ISSUED' ? 'badge-success' : 'badge-danger'
                }`}
              >
                {cert.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 text-sm">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">CVID (Crockford Base32)</span>
                <span className="font-mono text-base font-bold text-indigo-700">{cert.cvid}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">Recipient Student</span>
                <span className="font-medium text-slate-900">{cert.participations?.students?.full_name || 'Student'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">Activity Title</span>
                <span className="font-medium text-slate-900">{cert.participations?.activities?.title || 'Activity'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">Issued Timestamp</span>
                <span className="text-slate-700">{new Date(cert.issued_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
              <a
                href={`/api/v1/certificates/${cert.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
              >
                Download Vector PDF &rarr;
              </a>

              {(cert.status === 'VALID' || cert.status === 'ISSUED') && (
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <input
                    type="text"
                    placeholder="Revocation reason..."
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button
                    onClick={handleRevoke}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    Revoke Certificate
                  </button>
                </div>
              )}

              {cert.status === 'REVOKED' && (
                <button
                  onClick={handleReissue}
                  className="sm:ml-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Reissue Credential &rarr;
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </RoleGate>
  );
}
