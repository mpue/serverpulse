import nodemailer from 'nodemailer';
import http from 'http';
import https from 'https';
import { env } from '../config/env';
import type { NotificationChannel, AlertEvent, AlertRule } from '../types/alert';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!transporter && env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();
  if (!t) { console.warn('SMTP not configured, skipping email'); return; }
  await t.sendMail({ from: env.SMTP_FROM, to, subject, html });
}

async function sendWebhook(url: string, payload: unknown): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(payload);

    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000,
    }, (res) => { res.resume(); resolve(res.statusCode || 0); });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Webhook timeout')); });
    req.write(data);
    req.end();
  });
}

interface InAppNotification {
  id: number;
  ruleId: number;
  ruleName: string;
  severity: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const inAppNotifications: InAppNotification[] = [];

export function addInAppNotification(n: Omit<InAppNotification, 'id' | 'read' | 'createdAt'>): void {
  inAppNotifications.push({ ...n, id: Date.now(), read: false, createdAt: new Date().toISOString() });
  if (inAppNotifications.length > 500) inAppNotifications.shift();
}

export function getInAppNotifications(): InAppNotification[] {
  return inAppNotifications;
}

export async function dispatch(
  channels: NotificationChannel[],
  alertEvent: AlertEvent,
  rule: AlertRule
): Promise<{ type: string; status: string }[]> {
  const results: { type: string; status: string }[] = [];

  for (const ch of channels) {
    try {
      if (ch.type === 'email') {
        await sendEmail(ch.target,
          `[ServerPulse Alert] ${rule.severity.toUpperCase()}: ${rule.name}`,
          `<h2>Alert: ${rule.name}</h2>
           <p><strong>Process:</strong> ${rule.process_name}</p>
           <p><strong>Metric:</strong> ${rule.metric} ${rule.operator} ${rule.threshold}</p>
           <p><strong>Current Value:</strong> ${alertEvent.metric_value}</p>
           <p><strong>Severity:</strong> ${rule.severity}</p>
           <p><strong>Time:</strong> ${alertEvent.fired_at}</p>`);
        results.push({ type: 'email', status: 'sent' });
      } else if (ch.type === 'webhook') {
        await sendWebhook(ch.target, {
          text: `[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.process_name} ${rule.metric} = ${alertEvent.metric_value}`,
          alert: { rule: rule.name, process: rule.process_name, metric: rule.metric, value: alertEvent.metric_value, severity: rule.severity },
        });
        results.push({ type: 'webhook', status: 'sent' });
      } else if (ch.type === 'inapp') {
        addInAppNotification({
          ruleId: rule.id, ruleName: rule.name, severity: rule.severity,
          message: `${rule.process_name} ${rule.metric} = ${alertEvent.metric_value} (threshold: ${rule.operator} ${rule.threshold})`,
        });
        results.push({ type: 'inapp', status: 'sent' });
      }
    } catch (err: unknown) {
      console.error(`Notification ${ch.type} failed:`, (err as Error).message);
      results.push({ type: ch.type, status: 'failed' });
    }
  }
  return results;
}
