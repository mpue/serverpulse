import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import type { ProcessInfo } from '../types/process';

const PROC = env.PROC_ROOT;

interface CpuTimes { utime: number; stime: number; }
const prevCpuTimes: Map<number, CpuTimes> = new Map();
let prevTotalCpu: { total: number; idle: number } | null = null;

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function getBootTime(): number {
  const stat = readFile(path.join(PROC, 'stat'));
  if (!stat) return 0;
  const line = stat.split('\n').find(l => l.startsWith('btime'));
  return line ? parseInt(line.split(/\s+/)[1], 10) : 0;
}

function getClkTck(): number { return 100; }

function getMemTotal(): number {
  const meminfo = readFile(path.join(PROC, 'meminfo'));
  if (!meminfo) return 1;
  const line = meminfo.split('\n').find(l => l.startsWith('MemTotal'));
  return line ? parseInt(line.split(/\s+/)[1], 10) * 1024 : 1;
}

function getTotalCpuTicks(): { total: number; idle: number } | null {
  const stat = readFile(path.join(PROC, 'stat'));
  if (!stat) return null;
  const cpuLine = stat.split('\n').find(l => l.startsWith('cpu '));
  if (!cpuLine) return null;
  const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
  const total = parts.reduce((a, b) => a + b, 0);
  const idle = parts[3] + (parts[4] || 0);
  return { total, idle };
}

function getUidMap(): Record<string, string> {
  const passwd = readFile('/etc/passwd');
  if (!passwd) return {};
  const map: Record<string, string> = {};
  for (const line of passwd.split('\n')) {
    const parts = line.split(':');
    if (parts.length >= 3) map[parts[2]] = parts[0];
  }
  return map;
}

export function collect(): ProcessInfo[] {
  const bootTime = getBootTime();
  const clkTck = getClkTck();
  const memTotal = getMemTotal();
  const uidMap = getUidMap();
  const totalCpu = getTotalCpuTicks();
  const totalCpuDelta = prevTotalCpu && totalCpu
    ? totalCpu.total - prevTotalCpu.total
    : 1;

  let entries: string[];
  try {
    entries = fs.readdirSync(PROC);
  } catch {
    return [];
  }

  const processes: ProcessInfo[] = [];

  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = parseInt(entry, 10);
    const pidPath = path.join(PROC, entry);

    const statContent = readFile(path.join(pidPath, 'stat'));
    if (!statContent) continue;

    const openParen = statContent.indexOf('(');
    const closeParen = statContent.lastIndexOf(')');
    if (openParen === -1 || closeParen === -1) continue;

    const comm = statContent.substring(openParen + 1, closeParen);
    const afterComm = statContent.substring(closeParen + 2).trim().split(/\s+/);
    const state = afterComm[0];
    const utime = parseInt(afterComm[11], 10) || 0;
    const stime = parseInt(afterComm[12], 10) || 0;
    const startTimeTicks = parseInt(afterComm[19], 10) || 0;
    const vsize = parseInt(afterComm[20], 10) || 0;
    const rssPages = parseInt(afterComm[21], 10) || 0;
    const rss = rssPages * 4096;

    let cpuPercent = 0;
    const prev = prevCpuTimes.get(pid);
    if (prev && totalCpuDelta > 0) {
      const procDelta = (utime + stime) - (prev.utime + prev.stime);
      cpuPercent = (procDelta / totalCpuDelta) * 100;
    }
    prevCpuTimes.set(pid, { utime, stime });

    const memPercent = (rss / memTotal) * 100;
    const startedEpoch = bootTime + startTimeTicks / clkTck;
    const started = new Date(startedEpoch * 1000).toISOString();

    let threads = 1;
    let uid = '0';
    const statusContent = readFile(path.join(pidPath, 'status'));
    if (statusContent) {
      const threadsLine = statusContent.split('\n').find(l => l.startsWith('Threads:'));
      if (threadsLine) threads = parseInt(threadsLine.split(/\s+/)[1], 10) || 1;
      const uidLine = statusContent.split('\n').find(l => l.startsWith('Uid:'));
      if (uidLine) uid = uidLine.split(/\s+/)[1];
    }

    const user = uidMap[uid] || uid;
    let cmdline = readFile(path.join(pidPath, 'cmdline'));
    cmdline = cmdline ? cmdline.replace(/\0/g, ' ').trim() : comm;

    processes.push({
      pid, name: comm, user,
      cpu: Math.round(cpuPercent * 100) / 100,
      mem: Math.round(memPercent * 100) / 100,
      vsz: Math.round(vsize / 1024),
      rss: Math.round(rss / 1024),
      state, started, threads, cmdline,
    });
  }

  prevTotalCpu = totalCpu;
  const activePids = new Set(processes.map(p => p.pid));
  for (const pid of prevCpuTimes.keys()) {
    if (!activePids.has(pid)) prevCpuTimes.delete(pid);
  }

  return processes;
}
