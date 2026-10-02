'use client';
import { useState, useEffect } from 'react';

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = (q = '') => {
    setLoading(true);
    fetch(`/api/v1/documents?q=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(data => {
        setRecords(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords(query);
  };

  if (loading && records.length === 0) return <div className="p-4">Loading records...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Records Repository</h1>
      
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input 
          type="text" 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          placeholder="Search records..." 
          className="border p-2 rounded flex-1"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Search</button>
      </form>

      {records.length === 0 ? (
        <p>No records found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((doc: any) => (
            <div key={doc.id} className="border p-4 rounded shadow-sm">
              <h3 className="font-semibold text-lg truncate">{doc.title}</h3>
              <p className="text-sm text-gray-500 mt-1">Class: {doc.class_code}</p>
              <p className="text-sm text-gray-500">Captured: {new Date(doc.captured_at).toLocaleDateString()}</p>
              <p className="text-sm text-gray-500 mb-4">Size: {(doc.size_bytes / 1024).toFixed(1)} KB</p>
              <a 
                href={`/api/v1/documents/${doc.id}/download`} 
                className="text-blue-600 hover:underline text-sm font-medium"
                target="_blank" rel="noreferrer"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
