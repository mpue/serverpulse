export interface NotificationChannel {
  type: 'email' | 'webhook' | 'inapp';
  target: string;
}

export interface AlertRule {
  id: number;
  user_id: number;
  name: string;
  process_name: string;
  metric: 'cpu' | 'memory' | 'missing' | 'restarts';
  operator: '>' | '<' | '=';
  threshold: number;
  duration_seconds: number;
  cooldown_seconds: number;
  severity: 'info' | 'warning' | 'critical';
  channels: NotificationChannel[];
  enabled: boolean;
  created_at: string;
}

export interface AlertEvent {
  id: number;
  rule_id: number;
  fired_at: string;
  resolved_at: string | null;
  metric_value: number;
  acknowledged: boolean;
  ack_user_id: number | null;
  channels_sent: NotificationChannel[];
  rule_name?: string;
  severity?: string;
}
