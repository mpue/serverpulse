export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  state: string;
  started: string;
  threads: number;
  cmdline: string;
}

export interface CpuCore {
  core: number;
  usage: number;
}

export interface CpuStats {
  overall: number;
  cores: CpuCore[];
  loadAvg: [number, number, number];
}

export interface MemoryStats {
  total: number;
  used: number;
  free: number;
  cached: number;
  buffers: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
}

export interface DiskInfo {
  mount: string;
  total: number;
  used: number;
  available: number;
  usePercent: number;
}

export interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
}

export interface NetworkStats {
  interfaces: NetworkInterface[];
  tcpConnections: number;
}

export interface SystemStats {
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskInfo[];
  network: NetworkStats;
  timestamp: string;
}
