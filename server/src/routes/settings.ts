import { Router } from 'express';
import { z } from 'zod';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const defaultSettings = {
  maxTemperature: '30',
  maxHumidity: '70',
  maxVOC: '300',
  deviceTimeoutMinutes: '2',
  maxWeightPercent: '85',
  alertsEnabled: 'true',
};
const settingSchema = z.object({ value: z.string().trim().min(1).max(100) });
const editableKeys = new Set(Object.keys(defaultSettings));

router.get('/settings', asyncRoute(async (_req, res) => {
  const saved = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  const values = new Map(Object.entries(defaultSettings));
  for (const setting of saved) values.set(setting.key, setting.value);
  res.json([...values].map(([key, value]) => ({ key, value, source: saved.some((setting) => setting.key === key) ? 'database' : 'default' })));
}));

router.put('/settings/:key', asyncRoute(async (req, res) => {
  const key = String(req.params.key);
  if (!editableKeys.has(key)) throw new HttpError(404, 'This setting is not configurable.');
  const { value } = parseInput(settingSchema, req.body);

  if (key === 'alertsEnabled' && !['true', 'false'].includes(value)) {
    throw new HttpError(400, 'alertsEnabled must be true or false.');
  }
  if (key !== 'alertsEnabled') {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) throw new HttpError(400, 'Thresholds must be positive numbers.');
  }

  const setting = await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  emitSocketEvent('settings:update', setting);
  res.json(setting);
}));

export default router;