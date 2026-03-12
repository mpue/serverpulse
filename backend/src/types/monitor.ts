export interface HttpMonitorConfig {
  type: 'http';
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  expectedStatus?: number;
  bodyContains?: string;
  timeoutMs: number;
}

export interface ProcessMonitorConfig {
  type: 'process';
  processName: string;
  metric: 'cpu' | 'memory_rss' | 'memory_vsz' | 'threads' | 'fds';
}

export interface ShellMonitorConfig {
  type: 'shell';
  command: string;
}

export type MonitorConfig = HttpMonitorConfig | ProcessMonitorConfig | ShellMonitorConfig;

export interface Monitor {
  id: number;
  user_id: number;
  name: string;
  type: 'http' | 'process' | 'shell';
  config: MonitorConfig;
  interval_seconds: number;
  retention_days: number;
  enabled: boolean;
  created_at: string;
}

export interface MetricRow {
  collected_at: string;
  value: number;
  labels: Record<string, unknown> | null;
}
