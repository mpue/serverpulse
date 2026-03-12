import globToRegExp from 'glob-to-regexp';
import { Server as IOServer } from 'socket.io';
import * as queries from '../db/queries';
import * as notifier from './notifier';
import type { ProcessInfo } from '../types/process';
import type { AlertRule, NotificationChannel } from '../types/alert';

interface RuleState {
  matchingSince: number | null;
  lastFiredAt: number | null;
  activeEventId: number | null;
}

const ruleState: Map<number, RuleState> = new Map();

function matchesProcess(processName: string, pattern: string): boolean {
  if (processName === pattern) return true;
  try {
    const re = globToRegExp(pattern, { extended: true });
    return re.test(processName);
  } catch { return false; }
}

function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '=': return Math.abs(value - threshold) < 0.01;
    default: return false;
  }
}

async function fireIfReady(rule: AlertRule, state: RuleState, metricValue: number, io?: IOServer): Promise<void> {
  const now = Date.now();
  if (!state.matchingSince) state.matchingSince = now;

  const durationMet = (now - state.matchingSince) / 1000 >= rule.duration_seconds;
  if (!durationMet) return;
  if (state.lastFiredAt && (now - state.lastFiredAt) / 1000 < rule.cooldown_seconds) return;
  if (state.activeEventId) return;

  const channels: NotificationChannel[] = typeof rule.channels === 'string'
    ? JSON.parse(rule.channels as unknown as string)
    : rule.channels;

  const { rows } = await queries.insertAlertEvent(rule.id, metricValue, channels);
  const event = rows[0];
  state.activeEventId = event.id;
  state.lastFiredAt = now;

  await notifier.dispatch(channels, event, rule);
  if (io) io.emit('alert:fired', { ...event, rule_name: rule.name, severity: rule.severity });
  console.log(`Alert fired: ${rule.name} (value: ${metricValue})`);
}

async function resolveIfActive(rule: AlertRule, state: RuleState, io?: IOServer): Promise<void> {
  if (state.activeEventId) {
    await queries.resolveAlertEvent(state.activeEventId);
    if (io) io.emit('alert:resolved', { id: state.activeEventId, rule_name: rule.name });
    console.log(`Alert resolved: ${rule.name}`);
    state.activeEventId = null;
  }
  state.matchingSince = null;
}

export async function evaluate(processList: ProcessInfo[], io?: IOServer): Promise<void> {
  const { rows: rules } = await queries.listAlertRules();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let state = ruleState.get(rule.id);
    if (!state) {
      state = { matchingSince: null, lastFiredAt: null, activeEventId: null };
      ruleState.set(rule.id, state);
    }

    if (rule.metric === 'missing') {
      const found = processList.some(p => matchesProcess(p.name, rule.process_name));
      if (!found) await fireIfReady(rule, state, 0, io);
      else await resolveIfActive(rule, state, io);
      continue;
    }

    const matching = processList.filter(p => matchesProcess(p.name, rule.process_name));
    if (matching.length === 0) continue;

    let triggered = false;
    for (const proc of matching) {
      let value: number;
      if (rule.metric === 'cpu') value = proc.cpu;
      else if (rule.metric === 'memory') value = proc.rss / 1024;
      else continue;

      if (evaluateCondition(value, rule.operator, rule.threshold)) {
        triggered = true;
        await fireIfReady(rule, state, value, io);
        break;
      }
    }
    if (!triggered) await resolveIfActive(rule, state, io);
  }
}
