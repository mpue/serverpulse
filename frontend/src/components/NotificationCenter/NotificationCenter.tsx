import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { AlertEvent } from '../../types/api';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AlertEvent[]>([]);
  const [open, setOpen] = useState(false);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe('alert:fired', (data) => {
      setNotifications((prev) => [data as AlertEvent, ...prev].slice(0, 50));
    });
    return unsub;
  }, [subscribe]);

  return (
    <div className="notification-bell" onClick={() => setOpen(!open)}>
      🔔
      {notifications.length > 0 && (
        <span className="notification-badge">{notifications.length}</span>
      )}
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, width: 320,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', maxHeight: 400, overflowY: 'auto',
          zIndex: 50,
        }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
            Notifications ({notifications.length})
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>
              No notifications
            </div>
          )}
          {notifications.map((n, i) => (
            <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span className={`badge badge-${n.severity || 'warning'}`}>{n.severity}</span>
              {' '}{n.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
