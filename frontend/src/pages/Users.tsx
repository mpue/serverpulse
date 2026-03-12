import React, { useEffect, useState } from 'react';
import { fetchUsers, createUser, updateUser, deleteUser, fetchAuditLog } from '../api/endpoints';
import type { UserPublic, AuditEntry } from '../types/api';

type Tab = 'users' | 'audit';

interface UserForm {
  id?: number;
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
}

const emptyUser: UserForm = { username: '', password: '', role: 'viewer' };

export default function Users() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [editing, setEditing] = useState<UserForm | null>(null);

  useEffect(() => { loadUsers(); loadAudit(); }, []);

  const loadUsers = async () => {
    const { data } = await fetchUsers();
    setUsers(data);
  };

  const loadAudit = async () => {
    const { data } = await fetchAuditLog();
    setAudit(data);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (editing.id) {
      const payload: Record<string, unknown> = { role: editing.role };
      if (editing.password) payload.password = editing.password;
      await updateUser(editing.id, payload);
    } else {
      await createUser(editing);
    }
    setEditing(null);
    loadUsers();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    await deleteUser(id);
    loadUsers();
  };

  return (
    <div>
      <div className="page-header flex-between">
        <h1>User Management</h1>
        <div className="flex gap-8">
          <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('users')}>Users</button>
          <button className={`btn ${tab === 'audit' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('audit')}>Audit Log</button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h3>Users</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...emptyUser })}>+ New User</button>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'critical' : u.role === 'operator' ? 'warning' : 'info'}`}>{u.role}</span></td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: u.id, username: u.username, password: '', role: u.role })}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Audit Log</h3>
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Details</th></tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.username}</td>
                  <td>{entry.action}</td>
                  <td>{entry.target}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.details}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No audit entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <>
          <div className="drawer-overlay" onClick={() => setEditing(null)} />
          <div className="drawer">
            <div className="flex-between" style={{ marginBottom: 20 }}>
              <h2>{editing.id ? 'Edit User' : 'New User'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Username</label>
              <input className="form-input" value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} disabled={!!editing.id} />
            </div>
            <div className="form-group">
              <label>Password {editing.id ? '(leave empty to keep)' : ''}</label>
              <input className="form-input" type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} required={!editing.id} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as UserForm['role'] })}>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </>
      )}
    </div>
  );
}
