import { Router } from 'express';
import { z } from 'zod';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const createDeviceSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  ipAddress: z.string().trim().optional(),
  firmware: z.string().trim().optional(),
});
const updateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  ipAddress: z.string().trim().nullable().optional(),
  firmware: z.string().trim().nullable().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'Provide at least one field to update.');

router.get('/devices', asyncRoute(async (_req, res) => {
  const devices = await prisma.device.findMany({
    include: {
      shelves: { include: { sensors: true }, orderBy: { name: 'asc' } },
      telemetries: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
    orderBy: { name: 'asc' },
  });
  const settings = await prisma.setting.findUnique({ where: { key: 'deviceTimeoutMinutes' } });
  const timeoutMinutes = Number(settings?.value ?? 2);

  res.json(devices.map(({ telemetries, shelves, ...device }) => {
    const lastTelemetry = telemetries[0];
    const lastSeen = device.lastSeen ?? lastTelemetry?.timestamp ?? null;
    return {
      ...device,
      lastSeen,
      status: lastSeen && Date.now() - lastSeen.getTime() < timeoutMinutes * 60 * 1000 ? 'ONLINE' : 'OFFLINE',
      shelves: shelves.map((shelf) => ({ shelfId: shelf.shelfId, name: shelf.name, sensors: shelf.sensors })),
    };
  }));
}));

router.post('/devices', asyncRoute(async (req, res) => {
  const payload = parseInput(createDeviceSchema, req.body);
  const device = await prisma.device.create({
    data: {
      deviceId: payload.deviceId,
      name: payload.name,
      ...(payload.ipAddress !== undefined ? { ipAddress: payload.ipAddress } : {}),
      ...(payload.firmware !== undefined ? { firmware: payload.firmware } : {}),
      status: 'OFFLINE',
    },
  });
  emitSocketEvent('device:update', { action: 'created', deviceId: device.deviceId });
  res.status(201).json(device);
}));

router.patch('/devices/:deviceId', asyncRoute(async (req, res) => {
  const payload = parseInput(updateDeviceSchema, req.body);
  const device = await prisma.device.update({
    where: { deviceId: String(req.params.deviceId) },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.ipAddress !== undefined ? { ipAddress: payload.ipAddress } : {}),
      ...(payload.firmware !== undefined ? { firmware: payload.firmware } : {}),
    },
  });
  emitSocketEvent('device:update', { action: 'updated', deviceId: device.deviceId });
  res.json(device);
}));

router.delete('/devices/:deviceId', asyncRoute(async (req, res) => {
  const device = await prisma.device.findUnique({ where: { deviceId: String(req.params.deviceId) } });
  if (!device) throw new HttpError(404, 'Device not found.');
  const [shelves, telemetry] = await Promise.all([
    prisma.shelf.count({ where: { deviceId: device.id } }),
    prisma.telemetry.count({ where: { deviceId: device.id } }),
  ]);
  if (shelves || telemetry) throw new HttpError(409, 'This device is still referenced by shelves or telemetry and cannot be deleted.');

  await prisma.device.delete({ where: { id: device.id } });
  emitSocketEvent('device:update', { action: 'deleted', deviceId: device.deviceId });
  res.status(204).end();
}));

export default router;