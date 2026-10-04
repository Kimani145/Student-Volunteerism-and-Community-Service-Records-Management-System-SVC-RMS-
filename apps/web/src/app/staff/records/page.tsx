'use client';

import { useState, useEffect } from 'react';
import { apiFetch, getAccessToken } from '@/lib/api-client';
import { RoleGate } from '@/lib/auth';

interface DocumentRecord {
  id: string;
  title: string;
  class_code: string;
  mime_type: string;
  size_bytes: number;
  captured_at: string;
  status: string;
  file_name: string;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [recordClass, setRecordClass] = useState('ATTENDANCE_REGISTER');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadRecords();
    loadActivities();
  }, []);

  const loadRecords = async (searchTerm = '') => {
    try {
      setLoading(true);
      const url = searchTerm ? `/documents?q=${encodeURIComponent(searchTerm)}` : '/documents';
      const res = await apiFetch<{ data: DocumentRecord[]; total: number }>(url);
      setRecords(res.data || []);
    } catch (err: unknown) {
      console.error('Failed to load records', err);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      const res = await apiFetch<Record<string, unknown>>('/activities');
      const items = res.items || [];
      setActivities(items);
      if (items.length > 0) {
        setSelectedActivityId(items[0].id);
      }
    } catch (e) {}
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadRecords(query);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedActivityId) {
      setMessage({ type: 'error', text: 'Please select a file and an activity.' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadTitle || selectedFile.name);
      formData.append('class_code', recordClass);

      const res = await fetch(`/api/v1/activities/${selectedActivityId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Upload failed');
      }

      setShowUploadModal(false);
      setMessage({ type: 'success', text: 'Document uploaded and archived successfully!' });
      setSelectedFile(null);
      setUploadTitle('');
      loadRecords();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <RoleGate roles={['STAFF', 'ADMIN']}>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Records Repository</h1>
            <p className="text-slate-500 text-sm mt-1">Archival records, evidence registers, and statutory compliance files</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition"
          >
            + Upload Document
          </button>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records by title, content, or metadata..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-lg transition"
          >
            Search
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Document Title</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Date Captured</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        {doc.title}
                        <div className="text-xs font-normal text-slate-400">{doc.file_name}</div>
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-slate-700">{doc.class_code}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {new Date(doc.captured_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {(doc.size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`badge ${
                            doc.status === 'ACTIVE'
                              ? 'badge-success'
                              : doc.status === 'LEGAL_HOLD'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {doc.status !== 'DISPOSED' ? (
                          <a
                            href={`/api/v1/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Download &rarr;
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Disposed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Upload Record Document</h3>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Related Activity</label>
                  <select
                    value={selectedActivityId}
                    onChange={(e) => setSelectedActivityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    required
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Tree Planting Attendance Sheet"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Record Class</label>
                  <select
                    value={recordClass}
                    onChange={(e) => setRecordClass(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="ATTENDANCE_REGISTER">Attendance Register</option>
                    <option value="APPROVAL_LETTER">Approval Letter</option>
                    <option value="PHOTO">Photo</option>
                    <option value="ACTIVITY_REPORT">Activity Report</option>
                    <option value="FINANCIAL">Financial Record</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    File (PDF, PNG, JPEG up to 10MB)
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RoleGate>
  );
}
