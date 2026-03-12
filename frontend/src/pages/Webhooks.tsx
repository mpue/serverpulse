import React, { useState, useEffect } from 'react';
import { fetchWebhooks, createWebhook, deleteWebhook, fetchWebhookEvents } from '../api/endpoints';
import type { Webhook, WebhookEvent } from '../types/api';

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [name, setName] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'webhooks' | 'events'>('webhooks');

  const load = async () => {
    try {
      const [wh, ev] = await Promise.all([fetchWebhooks(), fetchWebhookEvents(100)]);
      setWebhooks(wh.data);
      setEvents(ev.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const { data } = await createWebhook(name.trim());
    setNewSecret(data.secret || null);
    setName('');
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this webhook?')) return;
    await deleteWebhook(id);
    load();
  };

  return (
    <div>
      <div className="page-header"><h1>Webhooks</h1></div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'webhooks' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('webhooks')}>Webhooks</button>
        <button className={`btn ${tab === 'events' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('events')}>Events</button>
      </div>

      {tab === 'webhooks' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input className="form-input" placeholder="Webhook name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 300 }} />
            <button className="btn btn-primary" onClick={handleCreate}>Create Webhook</button>
          </div>

          {newSecret && (
            <div className="card" style={{ background: 'var(--bg-primary)', marginBottom: 16 }}>
              <strong>Webhook Secret (copy now, shown only once):</strong>
              <pre style={{ overflow: 'auto', fontSize: '0.8rem', marginTop: 8 }}>{newSecret}</pre>
              <button className="btn btn-ghost btn-sm" onClick={() => setNewSecret(null)}>Dismiss</button>
            </div>
          )}

          {loading ? <p>Loading...</p> : (
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Name</th><th>Enabled</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id}>
                    <td>{w.id}</td>
                    <td>{w.name}</td>
                    <td><span className={`badge badge-${w.enabled ? 'success' : 'critical'}`}>{w.enabled ? 'Yes' : 'No'}</span></td>
                    <td>{new Date(w.createdAt).toLocaleString()}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(w.id)}>Delete</button></td>
                  </tr>
                ))}
                {webhooks.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No webhooks</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'events' && (
        <div className="card">
          {loading ? <p>Loading...</p> : (
            <table className="data-table">
              <thead>
                <tr><th>Time</th><th>Webhook</th><th>Event</th><th>Title</th><th>Severity</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleString()}</td>
                    <td>{e.webhookName}</td>
                    <td><span className="badge badge-info">{e.eventType}</span></td>
                    <td>{e.title}</td>
                    <td><span className={`badge badge-${e.severity === 'warning' ? 'warning' : 'info'}`}>{e.severity}</span></td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No events yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
