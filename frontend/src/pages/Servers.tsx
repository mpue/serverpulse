import React, { useState, useEffect } from 'react';
import { fetchServers, registerServer, deleteServer } from '../api/endpoints';
import type { Server } from '../types/api';

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [name, setName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await fetchServers();
      setServers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const { data } = await registerServer(name.trim());
    setNewToken(data.agentToken || null);
    setName('');
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this server?')) return;
    await deleteServer(id);
    load();
  };

  return (
    <div>
      <div className="page-header"><h1>Servers</h1></div>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="form-input"
            placeholder="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 300 }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>Register Server</button>
        </div>

        {newToken && (
          <div className="card" style={{ background: 'var(--bg-primary)', marginBottom: 16 }}>
            <strong>Agent Token (copy now, shown only once):</strong>
            <pre style={{ overflow: 'auto', fontSize: '0.8rem', marginTop: 8 }}>{newToken}</pre>
            <button className="btn btn-ghost btn-sm" onClick={() => setNewToken(null)}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td><span className={`badge badge-${s.status === 'online' ? 'success' : s.status === 'stale' ? 'warning' : 'critical'}`}>{s.status}</span></td>
                  <td>{s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : 'Never'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button></td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No servers registered</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
