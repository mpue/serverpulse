import { pool } from '../config/db';

interface AnomalyConfig {
  monitorId: number;
  windowMinutes: number;
  zScoreThreshold: number;
  minDataPoints: number;
}

export async function detectAnomaly(
  value: number,
  config: AnomalyConfig,
): Promise<{ isAnomaly: boolean; zScore: number; mean: number; stdDev: number }> {
  const since = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  const result = await pool.query<{ avg: string; stddev: string; count: string }>(
    `SELECT AVG(value) as avg, STDDEV(value) as stddev, COUNT(*) as count
     FROM metrics
     WHERE monitor_id = $1 AND collected_at >= $2`,
    [config.monitorId, since],
  );

  const { avg, stddev, count } = result.rows[0];
  const mean = parseFloat(avg) || 0;
  const std = parseFloat(stddev) || 1;

  if (parseInt(count, 10) < config.minDataPoints) {
    return { isAnomaly: false, zScore: 0, mean, stdDev: std };
  }

  const zScore = Math.abs((value - mean) / std);
  return {
    isAnomaly: zScore >= config.zScoreThreshold,
    zScore,
    mean,
    stdDev: std,
  };
}
