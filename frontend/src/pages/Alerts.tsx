import React, { useEffect, useState } from 'react';
import { fetchAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, fetchAlertHistory, acknowledgeAlert } from '../api/endpoints';
import type { AlertRule, AlertEvent } from '../types/api';

type Tab = 'rules' | 'history';

const emptyRule: Partial<AlertRule> = {
  monitorId: undefined,
  metric: 'cpu',
  operator: '>',
  threshold: 80,
  duration: 10,
  severity: 'warning',
  cooldown: 300,
  channelIds: [],
  isEnabled: true,
};

export default function Alerts() {
  const [tab, setTab] = useState<Tab>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [editing, setEditing] = useState<Partial<AlertRule> | null>(null);

  useEffect(() => {
    loadRules();
    loadHistory();
  }, []);

  const loadRules = async () => {
    const { data } = await fetchAlertRules();
    setRules(data);
  };

  const loadHistory = async () => {
    const { data } = await fetchAlertHistory();
    setHistory(data);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (editing.id) {
      await updateAlertRule(editing.id, editing);
    } else {
      await createAlertRule(editing as Omit<AlertRule, 'id' | 'createdAt'>);
    }
    setEditing(null);
    loadRules();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this alert rule?')) return;
    await deleteAlertRule(id);
    loadRules();
  };

  const handleAck = async (eventId: number) => {
    await acknowledgeAlert(eventId);
    loadHistory();
  };

  return (
    <div>
      <div className="page-header flex-between">
        <h1>Alerts</h1>
        <div className="flex gap-8">
          <button className={`btn ${tab === 'rules' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('rules')}>Rules</button>
          <button className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('history')}>History</button>
        </div>
      </div>

      {tab === 'rules' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h3>Alert Rules</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...emptyRule })}>+ New Rule</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th><th>Operator</th><th>Threshold</th><th>Duration(s)</th><th>Severity</th><th>Enabled</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.metric}</td>
                  <td>{r.operator}</td>
                  <td>{r.threshold}</td>
                  <td>{r.duration}</td>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td>{r.isEnabled ? '✓' : '✗'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...r })}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Alert History</h3>
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Rule</th><th>Severity</th><th>Message</th><th>Ack</th></tr>
            </thead>
            <tbody>
              {history.map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.firedAt).toLocaleString()}</td>
                  <td>{ev.ruleId}</td>
                  <td><span className={`badge badge-${ev.severity}`}>{ev.severity}</span></td>
                  <td>{ev.message}</td>
                  <td>
                    {ev.acknowledgedAt ? (
                      <span className="badge badge-info">Acked</span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAck(ev.id)}>Ack</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <>
          <div className="drawer-overlay" onClick={() => setEditing(null)} />
          <div className="drawer">
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <h2>{editing.id ? 'Edit Rule' : 'New Rule'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Monitor ID</label>
              <input className="form-input" type="number" value={editing.monitorId ?? ''} onChange={(e) => setEditing({ ...editing, monitorId: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Metric</label>
              <select className="form-input" value={editing.metric} onChange={(e) => setEditing({ ...editing, metric: e.target.value })}>
                <option>cpu</option><option>mem</option><option>disk</option><option>response_time</option><option>status_code</option>
              </select>
            </div>
            <div className="form-group">
              <label>Operator</label>
              <select className="form-input" value={editing.operator} onChange={(e) => setEditing({ ...editing, operator: e.target.value as AlertRule['operator'] })}>
                <option>&gt;</option><option>&lt;</option><option>&gt;=</option><option>&lt;=</option><option>==</option><option>!=</option>
              </select>
            </div>
            <div className="form-group">
              <label>Threshold</label>
              <input className="form-input" type="number" value={editing.threshold} onChange={(e) => setEditing({ ...editing, threshold: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Duration (seconds)</label>
              <input className="form-input" type="number" value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Severity</label>
              <select className="form-input" value={editing.severity} onChange={(e) => setEditing({ ...editing, severity: e.target.value as AlertRule['severity'] })}>
                <option>info</option><option>warning</option><option>critical</option>
              </select>
            </div>
            <div className="form-group">
              <label>Cooldown (seconds)</label>
              <input className="form-input" type="number" value={editing.cooldown} onChange={(e) => setEditing({ ...editing, cooldown: Number(e.target.value) })} />
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
