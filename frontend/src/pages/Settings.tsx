import React, { useState, useEffect } from 'react';
import { fetchHealth, fetchSettings } from '../api/endpoints';
import { useThemeStore } from '../store/themeStore';
import type { HealthResponse } from '../types/api';

export default function Settings() {
  const { theme, setTheme } = useThemeStore();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchHealth().then(({ data }) => setHealth(data)).catch(() => {}),
      fetchSettings().then(({ data }) => setSettings(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      {/* Theme */}
      <div className="card">
        <div className="card-header">Appearance</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              className={`btn ${theme === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTheme(t)}
            >
              {t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '💻 System'}
            </button>
          ))}
        </div>
      </div>

      {/* App Info */}
      <div className="card">
        <div className="card-header">Application Info</div>
        {loading ? <p>Loading...</p> : (
          <div style={{ marginTop: 8 }}>
            {settings.app_name && <div><strong>Name:</strong> {settings.app_name}</div>}
            {settings.timezone && <div><strong>Timezone:</strong> {settings.timezone}</div>}
          </div>
        )}
      </div>

      {/* Health */}
      <div className="card">
        <div className="card-header">System Health</div>
        {health ? (
          <div style={{ marginTop: 8 }}>
            <div>
              <strong>Status:</strong>{' '}
              <span className={`badge badge-${health.status === 'ok' ? 'success' : health.status === 'degraded' ? 'warning' : 'critical'}`}>
                {health.status}
              </span>
            </div>
            <div><strong>Version:</strong> {health.version}</div>
            <div><strong>Uptime:</strong> {Math.floor(health.uptime / 60)} min</div>
            <div style={{ marginTop: 8 }}>
              {Object.entries(health.checks).map(([name, check]) => (
                <div key={name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge badge-${check.status === 'ok' ? 'success' : 'critical'}`}>{check.status}</span>
                  <span>{name}</span>
                  {check.latencyMs !== undefined && <span style={{ color: 'var(--text-secondary)' }}>{check.latencyMs}ms</span>}
                  {check.message && <span style={{ color: 'var(--text-secondary)' }}>{check.message}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>Could not fetch health info</p>
        )}
      </div>
    </div>
  );
}
