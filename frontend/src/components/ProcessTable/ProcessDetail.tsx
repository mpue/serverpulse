import React from 'react';
import type { ProcessInfo } from '../../types/api';

interface Props {
  process: ProcessInfo;
  onClose: () => void;
}

export default function ProcessDetail({ process, onClose }: Props) {
  return (
    <div className="drawer">
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <h2>Process Details — PID {process.pid}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      <div className="card">
        <div className="card-header">General</div>
        <table className="data-table">
          <tbody>
            <tr><td><strong>Name</strong></td><td>{process.name}</td></tr>
            <tr><td><strong>PID</strong></td><td>{process.pid}</td></tr>
            <tr><td><strong>User</strong></td><td>{process.user}</td></tr>
            <tr><td><strong>State</strong></td><td>{process.state}</td></tr>
            <tr><td><strong>CPU %</strong></td><td>{process.cpu.toFixed(2)}</td></tr>
            <tr><td><strong>MEM %</strong></td><td>{process.mem.toFixed(2)}</td></tr>
            <tr><td><strong>VSZ (KB)</strong></td><td>{process.vsz.toLocaleString()}</td></tr>
            <tr><td><strong>RSS (KB)</strong></td><td>{process.rss.toLocaleString()}</td></tr>
            <tr><td><strong>Threads</strong></td><td>{process.threads}</td></tr>
            <tr><td><strong>Started</strong></td><td>{new Date(process.started).toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">Command Line</div>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {process.cmdline}
        </pre>
      </div>
    </div>
  );
}
