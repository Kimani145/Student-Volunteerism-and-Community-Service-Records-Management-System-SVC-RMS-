'use client';
import { apiFetch } from '../../lib/api-client.js';

export default function ResetPassword() {
  const submit = async (e: any) => {
    e.preventDefault();
    const token = new URLSearchParams(window.location.search).get('token');
    await apiFetch('/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, newPassword: e.target.password.value }) });
    alert('Reset');
  };
  return <form onSubmit={submit}><input type="password" name="password" /><button type="submit">Reset</button></form>;
}
