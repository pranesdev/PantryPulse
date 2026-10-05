import { Router } from 'express';
import { z } from 'zod';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const readSchema = z.object({ read: z.boolean() });

router.get('/alerts', asyncRoute(async (req, res) => {
  const severity = typeof req.query.severity === 'string' ? req.query.severity.toUpperCase() : undefined;
  const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
  const unread = req.query.unread === 'true';
  const alerts = await prisma.alert.findMany({
    where: {
      ...(severity ? { severity } : {}),
      ...(resolved !== undefined ? { resolved } : {}),
      ...(unread ? { read: false } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: 500,
  });
  const [shelves, devices] = await Promise.all([
    prisma.shelf.findMany({ select: { id: true, name: true, shelfId: true } }),
    prisma.device.findMany({ select: { id: true, name: true, deviceId: true } }),
  ]);
  const shelfNames = new Map(shelves.map((shelf) => [shelf.id, shelf]));
  const deviceNames = new Map(devices.map((device) => [device.id, device]));

  res.json(alerts.map((alert) => ({
    ...alert,
    shelf: alert.shelfId ? shelfNames.get(alert.shelfId) ?? null : null,
    device: alert.deviceId ? deviceNames.get(alert.deviceId) ?? null : null,
  })));
}));

router.patch('/alerts/:id/read', asyncRoute(async (req, res) => {
  const { read } = parseInput(readSchema, req.body);
  const alert = await prisma.alert.update({ where: { id: String(req.params.id) }, data: { read } });
  emitSocketEvent('alert:update', alert);
  res.json(alert);
}));

router.post('/alerts/read-all', asyncRoute(async (_req, res) => {
  const result = await prisma.alert.updateMany({ where: { read: false }, data: { read: true } });
  emitSocketEvent('alerts:read-all', { count: result.count });
  res.json({ updated: result.count });
}));

router.patch('/alerts/:id/resolve', asyncRoute(async (req, res) => {
  const alert = await prisma.alert.update({ where: { id: String(req.params.id) }, data: { resolved: true, read: true } });
  emitSocketEvent('alert:update', alert);
  res.json(alert);
}));

export default router;