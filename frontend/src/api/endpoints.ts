import apiClient from './client';
import type {
  LoginResponse, ProcessInfo, Monitor, AlertRule, AlertEvent, MetricRow, UserPublic, AuditEntry,
  SetupStatus, HealthResponse, DashboardLayout, Server, MaintenanceWindow, ReportSchedule,
  AlertComment, Webhook, WebhookEvent,
} from '../types/api';

// Auth
export const login = (username: string, password: string) =>
  apiClient.post<LoginResponse>('/auth/login', { username, password });

export const logout = () =>
  apiClient.post('/auth/logout');

// Processes
export const fetchProcesses = () =>
  apiClient.get<ProcessInfo[]>('/processes');

export const killProcess = (pid: number, signal?: 'SIGKILL') =>
  apiClient.delete(`/processes/${pid}${signal ? `?signal=${signal}` : ''}`);

// Monitors
export const fetchMonitors = () =>
  apiClient.get<Monitor[]>('/monitors');

export const createMonitor = (data: Partial<Monitor>) =>
  apiClient.post<Monitor>('/monitors', data);

export const updateMonitor = (id: number, data: Partial<Monitor>) =>
  apiClient.put<Monitor>(`/monitors/${id}`, data);

export const deleteMonitor = (id: number) =>
  apiClient.delete(`/monitors/${id}`);

// Metrics
export const fetchMetrics = (monitorId: number, from?: string, to?: string) =>
  apiClient.get<MetricRow[]>(`/metrics/${monitorId}`, { params: { from, to } });

// Alerts
export const fetchAlertRules = () =>
  apiClient.get<AlertRule[]>('/alerts');

export const createAlertRule = (data: Partial<AlertRule>) =>
  apiClient.post<AlertRule>('/alerts', data);

export const updateAlertRule = (id: number, data: Partial<AlertRule>) =>
  apiClient.put<AlertRule>(`/alerts/${id}`, data);

export const deleteAlertRule = (id: number) =>
  apiClient.delete(`/alerts/${id}`);

export const fetchAlertHistory = (params?: { from?: string; to?: string; severity?: string }) =>
  apiClient.get<AlertEvent[]>('/alerts/history', { params });

export const acknowledgeAlert = (id: number) =>
  apiClient.post(`/alerts/history/${id}/ack`);

// Users
export const fetchUsers = () =>
  apiClient.get<UserPublic[]>('/users');

export const createUser = (data: { username: string; password: string; role: string }) =>
  apiClient.post<UserPublic>('/users', data);

export const updateUser = (id: number, data: Record<string, unknown>) =>
  apiClient.put<UserPublic>(`/users/${id}`, data);

export const deleteUser = (id: number) =>
  apiClient.delete(`/users/${id}`);

export const fetchAuditLog = () =>
  apiClient.get<AuditEntry[]>('/users/audit');

// ---------- Extension endpoints ----------

// Setup
export const fetchSetupStatus = () =>
  apiClient.get<SetupStatus>('/setup/status');

export const runSetup = (data: { username: string; email: string; password: string; appName?: string; timezone?: string }) =>
  apiClient.post('/setup', data);

// Health
export const fetchHealth = () =>
  apiClient.get<HealthResponse>('/health');

// Dashboard Layouts
export const fetchLayouts = () =>
  apiClient.get<DashboardLayout[]>('/layouts');

export const createLayout = (data: { name: string; layout: unknown; isDefault?: boolean }) =>
  apiClient.post<DashboardLayout>('/layouts', data);

export const updateLayout = (id: number, data: { name?: string; layout?: unknown; isDefault?: boolean }) =>
  apiClient.put<DashboardLayout>(`/layouts/${id}`, data);

export const deleteLayout = (id: number) =>
  apiClient.delete(`/layouts/${id}`);

// Servers
export const fetchServers = () =>
  apiClient.get<Server[]>('/servers');

export const registerServer = (name: string, allowedIp?: string) =>
  apiClient.post<Server>('/servers', { name, allowedIp });

export const updateServer = (id: number, data: { name?: string; allowedIp?: string | null }) =>
  apiClient.put<Server>(`/servers/${id}`, data);

export const rotateServerSecret = (id: number) =>
  apiClient.post<{ message: string; agentSecret: string }>(`/servers/${id}/rotate`);

export const deleteServer = (id: number) =>
  apiClient.delete(`/servers/${id}`);

// Maintenance Windows
export const fetchMaintenanceWindows = () =>
  apiClient.get<MaintenanceWindow[]>('/maintenance');

export const createMaintenanceWindow = (data: {
  name: string; startsAt: string; endsAt: string;
  serverId?: number | null; processName?: string | null; recurring?: string | null;
}) =>
  apiClient.post<MaintenanceWindow>('/maintenance', data);

export const deleteMaintenanceWindow = (id: number) =>
  apiClient.delete(`/maintenance/${id}`);

// Reports
export const downloadMetricsCSV = (monitorId: number, from?: string, to?: string) =>
  apiClient.get('/reports/metrics/csv', { params: { monitorId, from, to }, responseType: 'blob' });

export const downloadAlertsCSV = (from?: string, to?: string) =>
  apiClient.get('/reports/alerts/csv', { params: { from, to }, responseType: 'blob' });

export const fetchReportSummary = (days?: number) =>
  apiClient.get('/reports/summary', { params: { days } });

export const fetchReportSchedules = () =>
  apiClient.get<ReportSchedule[]>('/reports/schedules');

export const createReportSchedule = (data: Partial<ReportSchedule>) =>
  apiClient.post<ReportSchedule>('/reports/schedules', data);

export const deleteReportSchedule = (id: number) =>
  apiClient.delete(`/reports/schedules/${id}`);

// Alert Comments
export const fetchAlertComments = (eventId: number) =>
  apiClient.get<AlertComment[]>(`/alert-comments/${eventId}`);

export const createAlertComment = (eventId: number, content: string) =>
  apiClient.post<AlertComment>(`/alert-comments/${eventId}`, { content });

export const deleteAlertComment = (commentId: number) =>
  apiClient.delete(`/alert-comments/comment/${commentId}`);

// Webhooks
export const fetchWebhooks = () =>
  apiClient.get<Webhook[]>('/webhooks');

export const createWebhook = (name: string) =>
  apiClient.post<Webhook>('/webhooks', { name });

export const deleteWebhook = (id: number) =>
  apiClient.delete(`/webhooks/${id}`);

export const fetchWebhookEvents = (limit?: number) =>
  apiClient.get<WebhookEvent[]>('/webhooks/events', { params: { limit } });

// Settings
export const fetchSettings = () =>
  apiClient.get<Record<string, string>>('/settings');

export const updateTheme = (theme: 'light' | 'dark' | 'system') =>
  apiClient.put('/settings/theme', { theme });
