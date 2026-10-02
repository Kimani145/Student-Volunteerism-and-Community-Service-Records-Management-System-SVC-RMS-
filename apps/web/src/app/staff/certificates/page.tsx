'use client';

import { useState } from 'react';
import { apiFetch } from '../../../lib/api-client';

export default function StaffCertificatesPage() {
  const [certId, setCertId] = useState('');
  const [cert, setCert] = useState<any>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<any>(`/certificates/${certId}`);
      setCert(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch certificate');
      setCert(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!reason) return alert('Reason is required');
    try {
      await apiFetch(`/certificates/${cert.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      alert('Revoked successfully');
      setCert({ ...cert, status: 'REVOKED' });
    } catch (err: any) {
      alert(err.message || 'Failed to revoke');
    }
  };

  const handleReissue = async () => {
    try {
      const newCert = await apiFetch<any>(`/certificates/${cert.id}/reissue`, {
        method: 'POST',
      });
      alert(`Reissued successfully! New Cert ID: ${newCert.id}`);
      setCertId(newCert.id);
      setCert(newCert);
    } catch (err: any) {
      alert(err.message || 'Failed to reissue');
    }
  };

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Staff Certificate Management</h1>
      
      <form onSubmit={fetchCert} className="mb-8 flex gap-4">
        <input
          type="text"
          placeholder="Enter Certificate ID (UUID)..."
          className="border p-2 rounded flex-1"
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
          required
        />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
          Lookup
        </button>
      </form>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {cert && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Certificate Details</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><strong>ID:</strong> {cert.id}</div>
            <div><strong>CVID:</strong> {cert.cvid}</div>
            <div><strong>Student:</strong> {cert.participations.students.full_name}</div>
            <div><strong>Activity:</strong> {cert.participations.activities.title}</div>
            <div>
              <strong>Status:</strong>{' '}
              <span className={cert.status === 'VALID' || cert.status === 'ISSUED' ? 'text-green-600' : 'text-red-600'}>
                {cert.status}
              </span>
            </div>
            <div><strong>Issued At:</strong> {new Date(cert.issued_at).toLocaleString()}</div>
          </div>

          <div className="flex gap-4 border-t pt-4">
            <a
              href={`/api/v1/certificates/${cert.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="bg-gray-100 border px-4 py-2 rounded hover:bg-gray-200"
            >
              Download PDF
            </a>

            {(cert.status === 'VALID' || cert.status === 'ISSUED') && (
              <div className="flex gap-2 ml-auto">
                <input
                  type="text"
                  placeholder="Revocation reason"
                  className="border p-2 rounded text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  onClick={handleRevoke}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
                >
                  Revoke
                </button>
              </div>
            )}

            {cert.status === 'REVOKED' && (
              <button
                onClick={handleReissue}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 text-sm ml-auto"
              >
                Reissue Certificate
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
