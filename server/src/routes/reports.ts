import { Router } from 'express';
import { asyncRoute, HttpError } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const defaultFrom = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

function parseDate(value: unknown, fallback: Date, key: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new HttpError(400, `${key} must be a date string.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${key} must be a valid date.`);
  return date;
}

function groupByDay<T extends { timestamp: Date }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const day = row.timestamp.toISOString().slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), row]);
  }
  return [...groups].map(([date, values]) => ({
    date,
    count: values.length,
    averageTemperature: values.reduce((total, value) => total + ('temperature' in value ? Number(value.temperature) : 0), 0) / values.length,
    averageHumidity: values.reduce((total, value) => total + ('humidity' in value ? Number(value.humidity) : 0), 0) / values.length,
    averageVoc: values.reduce((total, value) => total + ('voc' in value ? Number(value.voc) : 0), 0) / values.length,
    averageWeight: values.reduce((total, value) => total + ('weight' in value ? Number(value.weight) : 0), 0) / values.length,
  }));
}

async function reportData(from: Date, to: Date) {
  if (from > to) throw new HttpError(400, 'from must be earlier than to.');
  const [telemetry, inventory, alerts, surplus, shelves] = await Promise.all([
    prisma.telemetry.findMany({ where: { timestamp: { gte: from, lte: to } }, include: { shelf: true }, orderBy: { timestamp: 'asc' }, take: 10000 }),
    prisma.inventoryItem.findMany({ include: { batch: { include: { foodItem: true } }, shelf: true, surplusItem: true } }),
    prisma.alert.findMany({ where: { timestamp: { gte: from, lte: to } }, orderBy: { timestamp: 'asc' } }),
    prisma.surplusItem.findMany({ where: { detectedAt: { gte: from, lte: to } } }),
    prisma.shelf.findMany({ include: { telemetry: { orderBy: { timestamp: 'desc' }, take: 1 } }, orderBy: { name: 'asc' } }),
  ]);
  const now = Date.now();
  const expired = inventory.filter((item) => item.batch.expiryDate.getTime() < now);
  const severityCounts = alerts.reduce<Record<string, number>>((counts, alert) => {
    counts[alert.severity] = (counts[alert.severity] ?? 0) + 1;
    return counts;
  }, {});
  const shelfUtilization = shelves.map((shelf) => {
    const reading = shelf.telemetry[0];
    return { shelfId: shelf.shelfId, name: shelf.name, capacity: shelf.maxCapacity, weight: reading?.weight ?? null, utilization: reading ? reading.weight / shelf.maxCapacity * 100 : null };
  });

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      telemetryPoints: telemetry.length,
      inventoryItems: inventory.length,
      expiringItems: inventory.filter((item) => item.batch.expiryDate.getTime() >= now && item.batch.expiryDate.getTime() <= now + 7 * 24 * 60 * 60 * 1000).length,
      expiredItems: expired.length,
      surplusDetected: surplus.length,
      surplusDonated: surplus.filter((item) => item.action === 'DONATION').length,
      alerts: alerts.length,
      alertsBySeverity: severityCounts,
    },
    telemetry: telemetry.map(({ shelf, ...row }) => ({ ...row, shelfId: shelf.shelfId, shelfName: shelf.name })),
    daily: groupByDay(telemetry),
    shelfUtilization,
    inventoryMix: inventory.reduce<Record<string, number>>((counts, item) => {
      const status = item.surplusItem ? (item.surplusItem.action ?? 'SURPLUS') : item.batch.expiryDate.getTime() < now ? 'EXPIRED' : item.status;
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {}),
    alerts,
    surplus: surplus.map((item) => ({ action: item.action, detectedAt: item.detectedAt })),
  };
}

router.get('/reports/export.csv', asyncRoute(async (req, res) => {
  const from = parseDate(req.query.from, defaultFrom(), 'from');
  const to = parseDate(req.query.to, new Date(), 'to');
  const data = await reportData(from, to);
  const rows = [
    ['timestamp', 'shelfId', 'shelfName', 'weightKg', 'temperatureC', 'humidityPercent', 'voc', 'gasStatus'],
    ...data.telemetry.map((row) => [row.timestamp.toISOString(), row.shelfId, row.shelfName, row.weight, row.temperature, row.humidity, row.voc, row.gasStatus]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pantrypulse-telemetry.csv"');
  res.send(csv);
}));

router.get('/reports', asyncRoute(async (req, res) => {
  const from = parseDate(req.query.from, defaultFrom(), 'from');
  const to = parseDate(req.query.to, new Date(), 'to');
  res.json(await reportData(from, to));
}));

export default router;