'use client';
import { apiFetch } from '../../lib/api-client.js';

export default function ForgotPassword() {
  const submit = async (e: any) => {
    e.preventDefault();
    await apiFetch('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: e.target.email.value }) });
    alert('Sent');
  };
  return <form onSubmit={submit}><input name="email" /><button type="submit">Send Reset</button></form>;
}
