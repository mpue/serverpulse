import React, { useState, useMemo } from 'react';
import { useProcesses } from '../hooks/useProcesses';
import { useAuthStore } from '../store/authStore';
import { killProcess } from '../api/endpoints';
import ProcessTable from '../components/ProcessTable/ProcessTable';
import ProcessDetail from '../components/ProcessTable/ProcessDetail';
import type { ProcessInfo } from '../types/api';

export default function Processes() {
  const processes = useProcesses();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProcessInfo | null>(null);
  const user = useAuthStore((s) => s.user);

  const filtered = useMemo(() => {
    if (!search) return processes;
    const q = search.toLowerCase();
    return processes.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q)
    );
  }, [processes, search]);

  const handleKill = async (pid: number, signal?: 'SIGKILL') => {
    if (!confirm(`Send ${signal || 'SIGTERM'} to PID ${pid}?`)) return;
    try {
      await killProcess(pid, signal);
    } catch (err) {
      alert('Failed to kill process');
    }
  };

  return (
    <div>
      <div className="page-header flex-between">
        <h1>Processes ({filtered.length})</h1>
        <input
          className="search-input"
          placeholder="Search by name or PID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <ProcessTable
          data={filtered}
          onRowClick={setSelected}
          canKill={user?.role === 'admin'}
          onKill={handleKill}
        />
      </div>

      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <ProcessDetail process={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
