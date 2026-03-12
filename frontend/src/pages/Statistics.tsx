import React, { useEffect, useState } from 'react';
import { fetchMonitors, fetchMetrics } from '../api/endpoints';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { Monitor, MetricRow } from '../types/api';

const RANGE_OPTIONS = [
  { label: '1h', ms: 3600000 },
  { label: '6h', ms: 21600000 },
  { label: '24h', ms: 86400000 },
  { label: '7d', ms: 604800000 },
];

const LINE_COLORS = ['#4f8cf7', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

export default function Statistics() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [range, setRange] = useState(RANGE_OPTIONS[0]);
  const [data, setData] = useState<Record<number, MetricRow[]>>({});

  useEffect(() => {
    fetchMonitors().then(({ data }) => {
      setMonitors(data);
      if (data.length) setSelected([data[0].id]);
    });
  }, []);

  useEffect(() => {
    if (!selected.length) return;
    const now = Date.now();
    const from = new Date(now - range.ms).toISOString();
    const to = new Date(now).toISOString();
    Promise.all(
      selected.map(async (id) => {
        const { data } = await fetchMetrics(id, from, to);
        return [id, data] as const;
      })
    ).then((results) => {
      const map: Record<number, MetricRow[]> = {};
      for (const [id, rows] of results) map[id] = rows;
      setData(map);
    });
  }, [selected, range]);

  const toggleMonitor = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // Merge datasets by timestamp
  const merged = (() => {
    const timeMap = new Map<string, Record<string, number | string>>();
    for (const id of selected) {
      const rows = data[id] ?? [];
      const mon = monitors.find((m) => m.id === id);
      for (const row of rows) {
        const key = row.ts;
        const entry = timeMap.get(key) ?? { time: new Date(row.ts).toLocaleTimeString() };
        entry[mon?.name ?? `Monitor ${id}`] = row.value;
        timeMap.set(key, entry);
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  })();

  return (
    <div>
      <div className="page-header flex-between">
        <h1>Statistics</h1>
        <div className="flex gap-8">
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt.label} className={`btn ${range.label === opt.label ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setRange(opt)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Select Monitors</div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {monitors.map((m) => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggleMonitor(m.id)} />
              {m.name}
            </label>
          ))}
          {monitors.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>No monitors configured</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Time Series</div>
        {merged.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No data for the selected range</p>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={merged}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3247" />
              <XAxis dataKey="time" stroke="#8b8fa3" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8b8fa3" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#222533', border: '1px solid #2e3247' }} />
              <Legend />
              {selected.map((id, i) => {
                const mon = monitors.find((m) => m.id === id);
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={mon?.name ?? `Monitor ${id}`}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
