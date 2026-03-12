import { Router, Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import { pool } from '../config/db';
import { env } from '../config/env';

const router = Router();
const startTime = Date.now();

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  message?: string;
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, CheckResult> = {};

  // Database check
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    checks.database = { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.database = { status: 'error', message: (err as Error).message };
  }

  // /proc filesystem check
  try {
    fs.accessSync(`${env.PROC_ROOT}/stat`, fs.constants.R_OK);
    checks.procfs = { status: 'ok' };
  } catch {
    checks.procfs = { status: 'error', message: `Cannot read ${env.PROC_ROOT}/stat` };
  }

  // Disk space check
  try {
    const free = os.freemem();
    const total = os.totalmem();
    const usedPercent = Math.round(((total - free) / total) * 100);
    checks.memory = { status: usedPercent > 95 ? 'error' : 'ok', message: `${usedPercent}% used` };
  } catch {
    checks.memory = { status: 'error', message: 'Cannot read memory info' };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  const anyError = Object.values(checks).some((c) => c.status === 'error');
  const status = allOk ? 'ok' : anyError ? 'error' : 'degraded';

  let version = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    version = pkg.version;
  } catch { /* ignore */ }

  const response = {
    status,
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  res.status(status === 'error' ? 503 : 200).json(response);
});

export default router;
