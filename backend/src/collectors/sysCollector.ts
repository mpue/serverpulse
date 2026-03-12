import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { env } from '../config/env';
import type { SystemStats, CpuStats, MemoryStats, DiskInfo, NetworkStats } from '../types/process';

const PROC = env.PROC_ROOT;

interface CpuTick { total: number; idle: number; }
let prevCpuData: { overall: CpuTick; cores: CpuTick[] } | null = null;
const prevNetData: Map<string, { rxBytes: number; txBytes: number }> = new Map();

function readFile(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function parseCpuLine(line: string): CpuTick {
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const total = parts.reduce((a, b) => a + b, 0);
  const idle = parts[3] + (parts[4] || 0);
  return { total, idle };
}

function collectCpu(): CpuStats {
  const stat = readFile(path.join(PROC, 'stat'));
  if (!stat) return { overall: 0, cores: [], loadAvg: [0, 0, 0] };

  const lines = stat.split('\n');
  const cpuLine = lines.find(l => l.startsWith('cpu '));
  const current = cpuLine ? parseCpuLine(cpuLine) : { total: 0, idle: 0 };

  let overall = 0;
  if (prevCpuData) {
    const td = current.total - prevCpuData.overall.total;
    const id = current.idle - prevCpuData.overall.idle;
    overall = td > 0 ? ((td - id) / td) * 100 : 0;
  }

  const coreLines = lines.filter(l => /^cpu\d+/.test(l));
  const cores = coreLines.map((cl, i) => {
    const cur = parseCpuLine(cl);
    let usage = 0;
    if (prevCpuData && prevCpuData.cores[i]) {
      const td = cur.total - prevCpuData.cores[i].total;
      const id = cur.idle - prevCpuData.cores[i].idle;
      usage = td > 0 ? ((td - id) / td) * 100 : 0;
    }
    return { core: i, usage: Math.round(usage * 100) / 100 };
  });

  const loadAvgContent = readFile(path.join(PROC, 'loadavg'));
  const loadAvg = (loadAvgContent
    ? loadAvgContent.split(/\s+/).slice(0, 3).map(Number)
    : [0, 0, 0]) as [number, number, number];

  prevCpuData = {
    overall: current,
    cores: coreLines.map(cl => parseCpuLine(cl)),
  };

  return { overall: Math.round(overall * 100) / 100, cores, loadAvg };
}

function collectMemory(): MemoryStats {
  const meminfo = readFile(path.join(PROC, 'meminfo'));
  if (!meminfo) return { total: 0, used: 0, free: 0, cached: 0, buffers: 0, swapTotal: 0, swapUsed: 0, swapFree: 0 };

  const parse = (key: string): number => {
    const line = meminfo.split('\n').find(l => l.startsWith(key + ':'));
    return line ? parseInt(line.split(/\s+/)[1], 10) : 0;
  };

  const total = parse('MemTotal');
  const free = parse('MemFree');
  const buffers = parse('Buffers');
  const cached = parse('Cached');
  const used = total - free - buffers - cached;
  const swapTotal = parse('SwapTotal');
  const swapFree = parse('SwapFree');

  return { total, used, free, cached, buffers, swapTotal, swapUsed: swapTotal - swapFree, swapFree };
}

function collectDisk(): DiskInfo[] {
  try {
    const output = execSync('df -B1 --output=target,size,used,avail,pcent 2>/dev/null || df -k', {
      encoding: 'utf8', timeout: 5000,
    });
    return output.trim().split('\n').slice(1)
      .map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) return null;
        return {
          mount: parts[0],
          total: parseInt(parts[1], 10),
          used: parseInt(parts[2], 10),
          available: parseInt(parts[3], 10),
          usePercent: parseInt(parts[4], 10),
        };
      })
      .filter((d): d is DiskInfo => d !== null && d.mount.startsWith('/'));
  } catch {
    return [];
  }
}

function collectNetwork(): NetworkStats {
  const netDev = readFile(path.join(PROC, 'net/dev'));
  if (!netDev) return { interfaces: [], tcpConnections: 0 };

  const lines = netDev.split('\n').slice(2);
  const interfaces = lines
    .map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) return null;
      const name = parts[0].replace(':', '');
      if (name === 'lo') return null;
      const rxBytes = parseInt(parts[1], 10);
      const txBytes = parseInt(parts[9], 10);

      let rxRate = 0, txRate = 0;
      const prev = prevNetData.get(name);
      if (prev) {
        rxRate = (rxBytes - prev.rxBytes) / 5;
        txRate = (txBytes - prev.txBytes) / 5;
      }
      prevNetData.set(name, { rxBytes, txBytes });

      return { name, rxBytes, txBytes, rxRate: Math.round(rxRate), txRate: Math.round(txRate) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const tcp = readFile(path.join(PROC, 'net/tcp'));
  const tcpConnections = tcp ? tcp.split('\n').slice(1).filter(l => l.trim()).length : 0;

  return { interfaces, tcpConnections };
}

export function collect(): SystemStats {
  return {
    cpu: collectCpu(),
    memory: collectMemory(),
    disk: collectDisk(),
    network: collectNetwork(),
    timestamp: new Date().toISOString(),
  };
}
