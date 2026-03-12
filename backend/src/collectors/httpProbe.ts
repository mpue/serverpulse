import http from 'http';
import https from 'https';
import { insertMetric } from '../db/queries';
import type { Monitor, HttpMonitorConfig } from '../types/monitor';

export async function probe(monitor: Monitor): Promise<{ elapsed: number; statusCode: number; success: boolean }> {
  const config = monitor.config as HttpMonitorConfig;
  const url = new URL(config.url);
  const transport = url.protocol === 'https:' ? https : http;
  const timeoutMs = config.timeoutMs || 5000;

  return new Promise((resolve) => {
    const start = Date.now();

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: config.method || 'GET',
      headers: config.headers || {},
      timeout: timeoutMs,
    };

    const req = transport.request(options, (res) => {
      const elapsed = Date.now() - start;
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', async () => {
        const statusCode = res.statusCode || 0;
        let success = statusCode >= 200 && statusCode < 400;
        if (config.expectedStatus && statusCode !== config.expectedStatus) success = false;
        if (config.bodyContains && !body.includes(config.bodyContains)) success = false;

        try {
          await insertMetric(monitor.id, elapsed, { status_code: statusCode, success });
        } catch (err: unknown) {
          console.error('Failed to insert HTTP probe metric:', (err as Error).message);
        }
        resolve({ elapsed, statusCode, success });
      });
    });

    req.on('error', async (err: Error) => {
      const elapsed = Date.now() - start;
      try {
        await insertMetric(monitor.id, elapsed, { status_code: 0, success: false, error: err.message });
      } catch (e: unknown) {
        console.error('Failed to insert HTTP probe metric:', (e as Error).message);
      }
      resolve({ elapsed, statusCode: 0, success: false });
    });

    req.on('timeout', () => { req.destroy(); });
    req.end();
  });
}
