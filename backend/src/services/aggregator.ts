import * as queries from '../db/queries';

export async function rollup(): Promise<void> {
  console.log('Running metric rollup...');
  try {
    const { rows: monitors } = await queries.listMonitors();

    for (const monitor of monitors) {
      const retentionDays = monitor.retention_days || 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const result = await queries.deleteOldMetrics(monitor.id, cutoff.toISOString());
      if (result.rowCount && result.rowCount > 0) {
        console.log(`Deleted ${result.rowCount} old metrics for monitor ${monitor.id} (${monitor.name})`);
      }
    }
    console.log('Metric rollup complete.');
  } catch (err) {
    console.error('Rollup error:', err);
  }
}
