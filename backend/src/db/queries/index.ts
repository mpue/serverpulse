import { pool } from '../../config/db';
import type { User, UserPublic } from '../../types/user';
import type { AlertRule, AlertEvent } from '../../types/alert';
import type { Monitor, MetricRow } from '../../types/monitor';
import type { QueryResult } from 'pg';

// ---------- Users ----------
export const findUserByUsername = (username: string): Promise<QueryResult<User>> =>
  pool.query('SELECT * FROM users WHERE username = $1', [username]);

export const findUserById = (id: number): Promise<QueryResult<UserPublic>> =>
  pool.query('SELECT id, username, email, role, totp_secret, created_at FROM users WHERE id = $1', [id]);

export const listUsers = (): Promise<QueryResult<UserPublic>> =>
  pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id');

export const createUser = (
  username: string, email: string, passwordHash: string, role: string
): Promise<QueryResult<UserPublic>> =>
  pool.query(
    'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
    [username, email, passwordHash, role]
  );

export const updateUser = (id: number, fields: Record<string, unknown>): Promise<QueryResult<UserPublic>> => {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    vals.push(value);
    i++;
  }
  vals.push(id);
  return pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, username, email, role, created_at`,
    vals
  );
};

export const deleteUser = (id: number): Promise<QueryResult> =>
  pool.query('DELETE FROM users WHERE id = $1', [id]);

// ---------- Refresh Tokens ----------
export const insertRefreshToken = (userId: number, tokenHash: string, expiresAt: Date): Promise<QueryResult> =>
  pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

export const findRefreshToken = (tokenHash: string): Promise<QueryResult> =>
  pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()', [tokenHash]);

export const deleteRefreshToken = (tokenHash: string): Promise<QueryResult> =>
  pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

export const deleteUserRefreshTokens = (userId: number): Promise<QueryResult> =>
  pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

// ---------- Monitors ----------
export const listMonitors = (): Promise<QueryResult<Monitor>> =>
  pool.query('SELECT * FROM monitors ORDER BY id');

export const getMonitor = (id: number): Promise<QueryResult<Monitor>> =>
  pool.query('SELECT * FROM monitors WHERE id = $1', [id]);

export const createMonitor = (
  userId: number, name: string, type: string, config: unknown,
  intervalSeconds: number, retentionDays: number
): Promise<QueryResult<Monitor>> =>
  pool.query(
    'INSERT INTO monitors (user_id, name, type, config, interval_seconds, retention_days) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [userId, name, type, JSON.stringify(config), intervalSeconds, retentionDays]
  );

export const updateMonitor = (id: number, fields: Record<string, unknown>): Promise<QueryResult<Monitor>> => {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    vals.push(key === 'config' ? JSON.stringify(value) : value);
    i++;
  }
  vals.push(id);
  return pool.query(`UPDATE monitors SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
};

export const deleteMonitor = (id: number): Promise<QueryResult> =>
  pool.query('DELETE FROM monitors WHERE id = $1', [id]);

// ---------- Metrics ----------
export const insertMetric = (monitorId: number, value: number, labels: unknown): Promise<QueryResult> =>
  pool.query(
    'INSERT INTO metrics (monitor_id, value, labels) VALUES ($1, $2, $3)',
    [monitorId, value, JSON.stringify(labels)]
  );

export const queryMetrics = (
  monitorId: number, from: string, to: string, limit = 5000
): Promise<QueryResult<MetricRow>> =>
  pool.query(
    'SELECT collected_at, value, labels FROM metrics WHERE monitor_id = $1 AND collected_at >= $2 AND collected_at <= $3 ORDER BY collected_at ASC LIMIT $4',
    [monitorId, from, to, limit]
  );

export const deleteOldMetrics = (monitorId: number, before: string): Promise<QueryResult> =>
  pool.query('DELETE FROM metrics WHERE monitor_id = $1 AND collected_at < $2', [monitorId, before]);

// ---------- Alert Rules ----------
export const listAlertRules = (): Promise<QueryResult<AlertRule>> =>
  pool.query('SELECT * FROM alert_rules ORDER BY id');

export const getAlertRule = (id: number): Promise<QueryResult<AlertRule>> =>
  pool.query('SELECT * FROM alert_rules WHERE id = $1', [id]);

export const createAlertRule = (userId: number, fields: {
  name: string; processName: string; metric: string; operator: string;
  threshold: number; durationSeconds?: number; cooldownSeconds?: number;
  severity?: string; channels?: unknown[];
}): Promise<QueryResult<AlertRule>> =>
  pool.query(
    `INSERT INTO alert_rules (user_id, name, process_name, metric, operator, threshold, duration_seconds, cooldown_seconds, severity, channels)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [userId, fields.name, fields.processName, fields.metric, fields.operator, fields.threshold,
     fields.durationSeconds ?? 0, fields.cooldownSeconds ?? 300, fields.severity ?? 'warning',
     JSON.stringify(fields.channels ?? [])]
  );

export const updateAlertRule = (id: number, fields: Record<string, unknown>): Promise<QueryResult<AlertRule>> => {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    vals.push(key === 'channels' ? JSON.stringify(value) : value);
    i++;
  }
  vals.push(id);
  return pool.query(`UPDATE alert_rules SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
};

export const deleteAlertRule = (id: number): Promise<QueryResult> =>
  pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);

// ---------- Alert Events ----------
export const insertAlertEvent = (
  ruleId: number, metricValue: number, channelsSent: unknown
): Promise<QueryResult<AlertEvent>> =>
  pool.query(
    'INSERT INTO alert_events (rule_id, metric_value, channels_sent) VALUES ($1, $2, $3) RETURNING *',
    [ruleId, metricValue, JSON.stringify(channelsSent)]
  );

export const resolveAlertEvent = (id: number): Promise<QueryResult> =>
  pool.query('UPDATE alert_events SET resolved_at = NOW() WHERE id = $1', [id]);

export const acknowledgeAlertEvent = (id: number, userId: number): Promise<QueryResult> =>
  pool.query('UPDATE alert_events SET acknowledged = TRUE, ack_user_id = $2 WHERE id = $1', [id, userId]);

export const queryAlertEvents = (filters: {
  from?: string; to?: string; severity?: string;
} = {}): Promise<QueryResult<AlertEvent & { rule_name: string; severity: string }>> => {
  const conditions: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (filters.from) { conditions.push(`fired_at >= $${i}`); vals.push(filters.from); i++; }
  if (filters.to) { conditions.push(`fired_at <= $${i}`); vals.push(filters.to); i++; }
  if (filters.severity) {
    conditions.push(`rule_id IN (SELECT id FROM alert_rules WHERE severity = $${i})`);
    vals.push(filters.severity); i++;
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return pool.query(
    `SELECT ae.*, ar.name as rule_name, ar.severity FROM alert_events ae JOIN alert_rules ar ON ae.rule_id = ar.id ${where} ORDER BY fired_at DESC LIMIT 500`,
    vals
  );
};

// ---------- Audit Log ----------
export const insertAuditLog = (
  userId: number | null, action: string, target: string | null, ipAddress: string | null
): Promise<QueryResult> =>
  pool.query(
    'INSERT INTO audit_log (user_id, action, target, ip_address) VALUES ($1, $2, $3, $4)',
    [userId, action, target, ipAddress]
  );

export const queryAuditLog = (limit = 200): Promise<QueryResult> =>
  pool.query(
    'SELECT al.*, u.username FROM audit_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT $1',
    [limit]
  );
