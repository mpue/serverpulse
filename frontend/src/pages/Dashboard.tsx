import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import type { SystemStats } from '../types/api';

const COLORS = ['#4f8cf7', '#e74c3c', '#2ecc71', '#f39c12'];

export default function Dashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<{ time: string; usage: number }[]>([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe('system', (data) => {
      const s = data as SystemStats;
      setStats(s);
      setCpuHistory((prev) => {
        const next = [...prev, { time: new Date(s.timestamp).toLocaleTimeString(), usage: s.cpu.overall }];
        return next.slice(-30);
      });
    });
    return unsub;
  }, [subscribe]);

  if (!stats) {
    return (
      <div>
        <div className="page-header"><h1>System Dashboard</h1></div>
        <div className="card">Waiting for system data...</div>
      </div>
    );
  }

  const memData = [
    { name: 'Used', value: stats.memory.used },
    { name: 'Cached', value: stats.memory.cached },
    { name: 'Free', value: stats.memory.free },
  ];

  return (
    <div>
      <div className="page-header"><h1>System Dashboard</h1></div>

      {/* CPU Overview */}
      <div className="stat-grid">
        <div className="card">
          <div className="card-header">CPU Usage</div>
          <div className="card-value">{stats.cpu.overall}%</div>
        </div>
        <div className="card">
          <div className="card-header">Load Average</div>
          <div className="card-value" style={{ fontSize: '1.2rem' }}>
            {stats.cpu.loadAvg[0].toFixed(2)} / {stats.cpu.loadAvg[1].toFixed(2)} / {stats.cpu.loadAvg[2].toFixed(2)}
          </div>
        </div>
        <div className="card">
          <div className="card-header">Memory Used</div>
          <div className="card-value">{Math.round(stats.memory.used / 1024)} MB</div>
        </div>
        <div className="card">
          <div className="card-header">Swap Used</div>
          <div className="card-value">{Math.round(stats.memory.swapUsed / 1024)} MB</div>
        </div>
        <div className="card">
          <div className="card-header">TCP Connections</div>
          <div className="card-value">{stats.network.tcpConnections}</div>
        </div>
      </div>

      {/* CPU History Chart */}
      <div className="card">
        <div className="card-header">CPU Usage (last 60s)</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={cpuHistory}>
            <XAxis dataKey="time" stroke="#8b8fa3" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} stroke="#8b8fa3" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#222533', border: '1px solid #2e3247' }} />
            <Line type="monotone" dataKey="usage" stroke="#4f8cf7" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        {/* Per-Core CPU */}
        <div className="card">
          <div className="card-header">Per-Core CPU</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.cpu.cores}>
              <XAxis dataKey="core" stroke="#8b8fa3" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="#8b8fa3" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#222533', border: '1px solid #2e3247' }} />
              <Bar dataKey="usage" fill="#4f8cf7" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Memory Donut */}
        <div className="card">
          <div className="card-header">Memory Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={memData} innerRadius={50} outerRadius={80} dataKey="value" label={({ name }) => name}>
                {memData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#222533', border: '1px solid #2e3247' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disk */}
      <div className="card">
        <div className="card-header">Disk Usage</div>
        <ResponsiveContainer width="100%" height={Math.max(100, stats.disk.length * 40)}>
          <BarChart data={stats.disk} layout="vertical">
            <XAxis type="number" domain={[0, 100]} stroke="#8b8fa3" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="mount" stroke="#8b8fa3" tick={{ fontSize: 11 }} width={120} />
            <Tooltip contentStyle={{ background: '#222533', border: '1px solid #2e3247' }} />
            <Bar dataKey="usePercent" fill="#f39c12" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Network */}
      <div className="card">
        <div className="card-header">Network Interfaces</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Interface</th>
              <th>RX Bytes</th>
              <th>TX Bytes</th>
              <th>RX Rate (B/s)</th>
              <th>TX Rate (B/s)</th>
            </tr>
          </thead>
          <tbody>
            {stats.network.interfaces.map((iface) => (
              <tr key={iface.name}>
                <td>{iface.name}</td>
                <td>{(iface.rxBytes / 1024 / 1024).toFixed(1)} MB</td>
                <td>{(iface.txBytes / 1024 / 1024).toFixed(1)} MB</td>
                <td>{iface.rxRate}</td>
                <td>{iface.txRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
