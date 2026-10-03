'use client';
import { useState } from 'react';
import { apiFetch } from '../../lib/api-client.js';

export default function RegisterPage() {
  const [data, setData] = useState({ email: '', password: '', regNumber: '', fullName: '', schoolId: 1, programme: '', yearOfStudy: 1, noticeVersion: 'v0.1' });
  const register = async (e: any) => {
    e.preventDefault();
    await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    alert('Registered. Check email.');
  };
  return <form onSubmit={register}><input type="email" value={data.email} onChange={e=>setData({...data, email: e.target.value})}/><button type="submit">Register</button></form>;
}
