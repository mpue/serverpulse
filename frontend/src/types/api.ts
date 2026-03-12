export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  state: string;
  started: string;
  threads: number;
  cmdline: string;
}

export interface CpuCore {
  core: number;
  usage: number;
}

export interface CpuStats {
  overall: number;
  cores: CpuCore[];
  loadAvg: [number, number, number];
}

export interface MemoryStats {
  total: number;
  used: number;
  free: number;
  cached: number;
  buffers: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
}

export interface DiskInfo {
  mount: string;
  total: number;
  used: number;
  available: number;
  usePercent: number;
}

export interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
}

export interface NetworkStats {
  interfaces: NetworkInterface[];
  tcpConnections: number;
}

export interface SystemStats {
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskInfo[];
  network: NetworkStats;
  timestamp: string;
}

export interface UserPublic {
  id: number;
  username: string;
  role: Role;
  createdAt: string;
}

export interface AlertRule {
  id: number;
  monitorId?: number;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  cooldown: number;
  channelIds: number[];
  isEnabled: boolean;
  createdAt: string;
}

export interface AlertEvent {
  id: number;
  ruleId: number;
  firedAt: string;
  resolvedAt: string | null;
  severity: string;
  message: string;
  acknowledgedAt: string | null;
}

export interface Monitor {
  id: number;
  name: string;
  type: 'http' | 'process' | 'shell';
  config: Record<string, unknown>;
  intervalSec: number;
  retentionDays: number;
  isEnabled: boolean;
  createdAt: string;
}

export interface MetricRow {
  ts: string;
  value: number;
  labels: Record<string, unknown> | null;
}

export interface AuditEntry {
  id: number;
  username: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

// ---------- Extension types ----------

export interface SetupStatus {
  setupRequired: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, { status: string; latencyMs?: number; message?: string }>;
}

export interface DashboardLayout {
  id: number;
  userId: number;
  name: string;
  layout: LayoutWidget[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'cpu-gauge' | 'memory-donut' | 'disk-bars' | 'network-chart' | 'process-table' | 'metric-chart' | 'alert-feed' | 'top-processes';
}

export interface Server {
  id: number;
  name: string;
  status: 'online' | 'offline' | 'stale' | 'pending';
  lastSeenAt: string | null;
  allowedIp: string | null;
  tokenRotatedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  agentSecret?: string; // only on creation/rotation
}

export interface MaintenanceWindow {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  serverId: number | null;
  processName: string | null;
  recurring: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
}

export interface ReportSchedule {
  id: number;
  name: string;
  type: string;
  config: Record<string, unknown>;
  cronExpr: string;
  recipients: string[];
  enabled: boolean;
  createdAt: string;
}

export interface AlertComment {
  id: number;
  alertEventId: number;
  userId: number;
  username?: string;
  content: string;
  createdAt: string;
}

export interface Webhook {
  id: number;
  name: string;
  enabled: boolean;
  createdAt: string;
  secret?: string; // only on creation
}

export interface WebhookEvent {
  id: number;
  webhookId: number;
  webhookName?: string;
  eventType: string;
  title: string;
  description: string | null;
  severity: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
