import React, { useEffect, useState } from 'react';
import { fetchMonitors, createMonitor, updateMonitor, deleteMonitor } from '../api/endpoints';
import type { Monitor } from '../types/api';

type MonitorType = 'http' | 'process' | 'shell';

const emptyMonitor: Partial<Monitor> = {
  name: '',
  type: 'http',
  config: { url: '', method: 'GET', expectedStatus: 200, timeoutMs: 5000 },
  intervalSec: 60,
  retentionDays: 30,
  isEnabled: true,
};

export default function Monitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [editing, setEditing] = useState<Partial<Monitor> | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await fetchMonitors();
    setMonitors(data);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (editing.id) {
      await updateMonitor(editing.id, editing);
    } else {
      await createMonitor(editing as Omit<Monitor, 'id' | 'createdAt'>);
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this monitor?')) return;
    await deleteMonitor(id);
    load();
  };

  const onTypeChange = (type: MonitorType) => {
    let config: Record<string, unknown> = {};
    if (type === 'http') config = { url: '', method: 'GET', expectedStatus: 200, timeoutMs: 5000 };
    else if (type === 'process') config = { namePattern: '' };
    else if (type === 'shell') config = { command: '', expectedExitCode: 0, timeoutMs: 10000 };
    setEditing({ ...editing, type, config });
  };

  return (
    <div>
      <div className="page-header flex-between">
        <h1>Monitors</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...emptyMonitor })}>+ New Monitor</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Type</th><th>Interval</th><th>Retention</th><th>Enabled</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {monitors.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td><span className="badge badge-info">{m.type}</span></td>
                <td>{m.intervalSec}s</td>
                <td>{m.retentionDays}d</td>
                <td>{m.isEnabled ? '✓' : '✗'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...m })}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>Del</button>
                </td>
              </tr>
            ))}
            {monitors.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No monitors configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <>
          <div className="drawer-overlay" onClick={() => setEditing(null)} />
          <div className="drawer">
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <h2>{editing.id ? 'Edit Monitor' : 'New Monitor'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input className="form-input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select className="form-input" value={editing.type} onChange={(e) => onTypeChange(e.target.value as MonitorType)}>
                <option value="http">HTTP</option>
                <option value="process">Process</option>
                <option value="shell">Shell</option>
              </select>
            </div>

            {editing.type === 'http' && (
              <>
                <div className="form-group">
                  <label>URL</label>
                  <input className="form-input" value={(editing.config as any)?.url ?? ''} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, url: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Method</label>
                  <select className="form-input" value={(editing.config as any)?.method ?? 'GET'} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, method: e.target.value } })}>
                    <option>GET</option><option>POST</option><option>PUT</option><option>HEAD</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Expected Status</label>
                  <input className="form-input" type="number" value={(editing.config as any)?.expectedStatus ?? 200} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, expectedStatus: Number(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>Timeout (ms)</label>
                  <input className="form-input" type="number" value={(editing.config as any)?.timeoutMs ?? 5000} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, timeoutMs: Number(e.target.value) } })} />
                </div>
              </>
            )}

            {editing.type === 'process' && (
              <div className="form-group">
                <label>Name Pattern (glob)</label>
                <input className="form-input" value={(editing.config as any)?.namePattern ?? ''} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, namePattern: e.target.value } })} />
              </div>
            )}

            {editing.type === 'shell' && (
              <>
                <div className="form-group">
                  <label>Command</label>
                  <input className="form-input" value={(editing.config as any)?.command ?? ''} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, command: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Expected Exit Code</label>
                  <input className="form-input" type="number" value={(editing.config as any)?.expectedExitCode ?? 0} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, expectedExitCode: Number(e.target.value) } })} />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Interval (seconds)</label>
              <input className="form-input" type="number" value={editing.intervalSec ?? 60} onChange={(e) => setEditing({ ...editing, intervalSec: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Retention (days)</label>
              <input className="form-input" type="number" value={editing.retentionDays ?? 30} onChange={(e) => setEditing({ ...editing, retentionDays: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={editing.isEnabled} onChange={(e) => setEditing({ ...editing, isEnabled: e.target.checked })} />{' '}
                Enabled
              </label>
            </div>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </>
      )}
    </div>
  );
}
