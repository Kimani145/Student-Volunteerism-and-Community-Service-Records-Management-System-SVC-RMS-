'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyLookupPage() {
  const router = useRouter();
  const [cvid, setCvid] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = cvid.trim();
    if (!trimmed) {
      setError('Please enter a Certificate Verification ID (CVID).');
      return;
    }
    router.push(`/verify/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="max-w-lg mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-4 text-slate-900">Verify a Certificate</h1>
      <p className="text-slate-600 mb-6">
        Enter the Certificate Verification ID (CVID) printed on the certificate or found in
        the QR-code URL.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="cvid-input" className="block text-sm font-medium text-slate-700 mb-1">
            Certificate Verification ID (CVID)
          </label>
          <input
            id="cvid-input"
            type="text"
            value={cvid}
            onChange={(e) => { setCvid(e.target.value); setError(''); }}
            placeholder="e.g. A1B2C3D4E5F6"
            className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-6 py-2 transition"
        >
          Verify
        </button>
      </form>
    </main>
  );
}
