'use client';
import { apiFetch } from '@/lib/api-client';
import { useEffect, useState } from 'react';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState('Verifying...');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setStatus('Verified!'))
      .catch(() => setStatus('Failed to verify'));
  }, []);
  return <div>{status}</div>;
}
