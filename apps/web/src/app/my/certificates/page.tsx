'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api-client';

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
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Certificate[]>('/certificates/me')
      .then(setCerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Certificates</h1>
      
      {certs.length === 0 ? (
        <p>You have no certificates yet.</p>
      ) : (
        <div className="grid gap-4">
          {certs.map(cert => (
            <div key={cert.id} className="bg-white shadow rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">{cert.participations.activities.title}</h3>
                <p className="text-sm text-gray-600">
                  Issued: {new Date(cert.issued_at).toLocaleDateString()} &middot; CVID: {cert.cvid}
                </p>
                <div className="mt-1">
                  {cert.status === 'VALID' || cert.status === 'ISSUED' ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">VALID</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">REVOKED</span>
                  )}
                </div>
              </div>
              <a
                href={`/api/v1/certificates/${cert.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm font-medium"
              >
                Download PDF
              </a>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
