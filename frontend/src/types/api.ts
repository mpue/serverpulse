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
