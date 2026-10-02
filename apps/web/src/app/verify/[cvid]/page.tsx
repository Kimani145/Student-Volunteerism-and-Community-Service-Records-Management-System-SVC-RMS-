import { notFound } from 'next/navigation';


export default async function VerifyCertificatePage({ params }: { params: { cvid: string } }) {
  const { cvid } = params;

  const apiUrl = process.env.API_ORIGIN || 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/api/v1/public/verify/${cvid}`, {
    cache: 'no-store'
  });

  if (res.status === 404) {
    notFound();
  }

  if (res.status === 400 || res.status === 422 || res.status === 500) {
    const errorData = await res.json().catch(() => ({}));
    if (errorData.message === 'INVALID_SIGNATURE' || errorData.code === 'INVALID_SIGNATURE') {
      return (
        <main className="p-8 max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg">
            <h1 className="text-2xl font-bold mb-2">Signature Verification Failed</h1>
            <p>The certificate signature is invalid. It may have been forged or tampered with.</p>
          </div>
        </main>
      );
    }
    if (res.status === 500) {
      return <main className="p-8">Internal Server Error</main>;
    }
  }

  if (!res.ok) {
    return <main className="p-8">Failed to verify certificate.</main>;
  }

  const data = await res.json();
  const cert = data.certificate;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4 border-b pb-2">Certificate Verification</h1>
        
        <div className="mb-6 flex items-center">
          <span className="font-semibold w-32">Status:</span>
          {data.status === 'VALID' ? (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">VALID</span>
          ) : (
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-semibold">REVOKED</span>
          )}
        </div>

        {data.status === 'REVOKED' && (data.revocationDate || cert.revokedAt) && (
          <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">
            Revoked on: {new Date(data.revocationDate || cert.revokedAt).toLocaleString()}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Student Name</div>
            <div className="font-medium text-lg">{cert.studentName}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Activity</div>
            <div className="font-medium text-lg">{cert.activityTitle}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Date of Service</div>
            <div className="font-medium text-lg">{cert.serviceDate}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Service Hours</div>
            <div className="font-medium text-lg">{cert.hours}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Certificate ID</div>
            <div className="font-medium text-lg">{cert.cvid}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Issuer</div>
            <div className="font-medium text-lg">{cert.issuer}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Issued At</div>
            <div className="font-medium text-lg">{new Date(cert.issuedAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-400 border-t pt-4">
          Verified securely at {new Date(data.verifiedAt).toLocaleString()}
        </div>
      </div>
    </main>
  );
}
