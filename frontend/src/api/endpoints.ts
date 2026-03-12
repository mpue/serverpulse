import apiClient from './client';
import type {
  LoginResponse, ProcessInfo, Monitor, AlertRule, AlertEvent, MetricRow, UserPublic, AuditEntry
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
