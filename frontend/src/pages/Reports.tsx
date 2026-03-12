import React, { useState, useEffect } from 'react';
import { fetchReportSummary, downloadAlertsCSV, fetchMonitors } from '../api/endpoints';
import type { Monitor } from '../types/api';

export default function Reports() {
  const [summary, setSummary] = useState<any>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchReportSummary(days).then(({ data }) => setSummary(data)),
      fetchMonitors().then(({ data }) => setMonitors(data)),
    ]).finally(() => setLoading(false));
  }, [days]);

  const handleDownloadAlerts = async () => {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await downloadAlertsCSV(from);
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header"><h1>Reports</h1></div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <label>Period:</label>
        <select className="form-input" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 120 }}>
          <option value={1}>1 day</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="card">Loading...</div>
      ) : (
        <>
          {summary && (
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-header">Active Monitors</div>
                <div className="card-value">{summary.activeMonitors}</div>
              </div>
              <div className="card">
                <div className="card-header">Period</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{summary.period.days} days</div>
              </div>
              <div className="card">
                <div className="card-header">Alerts by Severity</div>
                {summary.alertsBySeverity?.length > 0 ? (
                  <div>
                    {summary.alertsBySeverity.map((a: any) => (
                      <div key={a.severity}>
                        <span className={`badge badge-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info'}`}>
                          {a.severity}
                        </span>{' '}
                        {a.count}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>No alerts</div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">Export</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleDownloadAlerts}>
                Download Alerts CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
