import { Router, Request, Response } from 'express';
import { collect } from '../collectors/procCollector';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import * as queries from '../db/queries';

const KILL_BLOCKLIST: ReadonlySet<string> = new Set([
  'init', 'systemd', 'kernel', 'kthreadd', 'postgres', 'sshd',
  'dockerd', 'containerd', 'node',
]);

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const processes = collect();
    res.json(processes);
  } catch (err) {
    console.error('Process list error:', err);
    res.status(500).json({ error: 'Failed to collect process data' });
  }
});

router.delete('/:pid', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const pid = parseInt(req.params.pid, 10);
    if (isNaN(pid) || pid <= 1) {
      res.status(400).json({ error: 'Invalid PID' });
      return;
    }

    // Look up process name to check blocklist
    const processes = collect();
    const proc = processes.find((p) => p.pid === pid);
    if (proc && KILL_BLOCKLIST.has(proc.name)) {
      res.status(403).json({ error: `Process '${proc.name}' is protected and cannot be killed.` });
      return;
    }

    const signal = req.query.signal === 'SIGKILL' ? 'SIGKILL' : 'SIGTERM';

    // Audit BEFORE executing the kill
    await queries.insertAuditLog(
      req.user!.id,
      `process_kill_${signal}`,
      `PID ${pid} (${proc?.name ?? 'unknown'})`,
      req.ip || null,
    );

    try {
      process.kill(pid, signal);
    } catch (err: unknown) {
      res.status(404).json({ error: `Failed to send ${signal} to PID ${pid}: ${(err as Error).message}` });
      return;
    }

    res.json({ message: `Sent ${signal} to PID ${pid}` });
  } catch (err) {
    console.error('Kill process error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
