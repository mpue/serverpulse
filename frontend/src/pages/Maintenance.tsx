import React, { useState, useEffect } from 'react';
import { fetchMaintenanceWindows, createMaintenanceWindow, deleteMaintenanceWindow } from '../api/endpoints';
import type { MaintenanceWindow } from '../types/api';

export default function Maintenance() {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [processName, setProcessName] = useState('');

  const load = async () => {
    try {
      const { data } = await fetchMaintenanceWindows();
      setWindows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const activeWindows = windows.filter((w) => new Date(w.startsAt) <= now && new Date(w.endsAt) >= now);

  const handleCreate = async () => {
    if (!name || !startsAt || !endsAt) return;
    await createMaintenanceWindow({
      name,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      processName: processName || null,
    });
    setName(''); setStartsAt(''); setEndsAt(''); setProcessName('');
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this maintenance window?')) return;
    await deleteMaintenanceWindow(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Maintenance Windows</h1>
      </div>

      {activeWindows.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--warning)', background: 'rgba(243,156,18,0.1)' }}>
          <strong>Active Maintenance:</strong>
          {activeWindows.map((w) => (
            <div key={w.id}>{w.name} — until {new Date(w.endsAt).toLocaleString()}</div>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{windows.length} total windows</span>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Window'}
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group">
              <label>Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Process Name (optional)</label>
              <input className="form-input" value={processName} onChange={(e) => setProcessName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Starts At</label>
              <input className="form-input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Ends At</label>
              <input className="form-input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Process</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {windows.map((w) => {
                const isActive = new Date(w.startsAt) <= now && new Date(w.endsAt) >= now;
                return (
                  <tr key={w.id} className={isActive ? 'row-yellow' : ''}>
                    <td>{w.name}</td>
                    <td>{new Date(w.startsAt).toLocaleString()}</td>
                    <td>{new Date(w.endsAt).toLocaleString()}</td>
                    <td>{w.processName || '—'}</td>
                    <td>{w.createdByName || w.createdBy}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(w.id)}>Delete</button></td>
                  </tr>
                );
              })}
              {windows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No maintenance windows</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
