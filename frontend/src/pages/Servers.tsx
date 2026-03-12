import React, { useState, useEffect } from 'react';
import { fetchServers, registerServer, deleteServer, rotateServerSecret, updateServer } from '../api/endpoints';
import type { Server } from '../types/api';

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [name, setName] = useState('');
  const [allowedIp, setAllowedIp] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editIp, setEditIp] = useState<{ id: number; value: string } | null>(null);

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
    const { data } = await registerServer(name.trim(), allowedIp || undefined);
    setSecret(data.agentSecret || null);
    setName('');
    setAllowedIp('');
    load();
  };

  const handleRotate = async (id: number) => {
    if (!confirm('Rotate secret? The old secret will stop working immediately.')) return;
    const { data } = await rotateServerSecret(id);
    setSecret(data.agentSecret);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this server?')) return;
    await deleteServer(id);
    load();
  };

  const handleSaveIp = async (id: number) => {
    if (!editIp) return;
    await updateServer(id, { allowedIp: editIp.value || null });
    setEditIp(null);
    load();
  };

  return (
    <div>
      <div className="page-header"><h1>Servers</h1></div>

      <div className="card">
        <div className="card-header">Register New Server</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Server name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 220 }} />
          <input className="form-input" placeholder="Allowed IP (optional)" value={allowedIp} onChange={(e) => setAllowedIp(e.target.value)} style={{ width: 180 }} />
          <button className="btn btn-primary" onClick={handleAdd}>Register</button>
        </div>
      </div>

      {secret && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(243,156,18,0.08)' }}>
          <strong>Agent Secret (copy now — shown only once!):</strong>
          <pre style={{ overflow: 'auto', fontSize: '0.8rem', marginTop: 8, padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>{secret}</pre>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            The agent uses this secret for HMAC-SHA256 challenge-response authentication.
            The secret is never transmitted over the network — only an HMAC signature of a server-issued challenge.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => setSecret(null)} style={{ marginTop: 8 }}>Dismiss</button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Allowed IP</th>
                <th>Last Seen</th>
                <th>Secret Rotated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>
                    <span className={`badge badge-${s.status === 'online' ? 'success' : s.status === 'pending' ? 'info' : 'critical'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {editIp?.id === s.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input className="form-input" value={editIp.value} onChange={(e) => setEditIp({ id: s.id, value: e.target.value })} style={{ width: 140, padding: '4px 8px' }} placeholder="any" />
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveIp(s.id)}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditIp(null)}>×</button>
                      </div>
                    ) : (
                      <span onClick={() => setEditIp({ id: s.id, value: s.allowedIp || '' })} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>
                        {s.allowedIp || 'any'}
                      </span>
                    )}
                  </td>
                  <td>{s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : 'Never'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{s.tokenRotatedAt ? new Date(s.tokenRotatedAt).toLocaleString() : '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRotate(s.id)} title="Rotate secret">🔄</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No servers registered</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
