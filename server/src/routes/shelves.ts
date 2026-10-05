import { Router } from 'express';
import { z } from 'zod';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const createShelfSchema = z.object({
  shelfId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  maxCapacity: z.number().finite().positive(),
  deviceId: z.string().trim().min(1),
});
const updateShelfSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  maxCapacity: z.number().finite().positive().optional(),
  deviceId: z.string().trim().min(1).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'Provide at least one field to update.');

router.get('/shelves', asyncRoute(async (_req, res) => {
  const [shelves, timeoutSetting] = await Promise.all([prisma.shelf.findMany({
    include: {
      device: true,
      sensors: true,
      telemetry: { orderBy: { timestamp: 'desc' }, take: 1 },
      _count: { select: { inventory: true } },
    },
    orderBy: { name: 'asc' },
  }), prisma.setting.findUnique({ where: { key: 'deviceTimeoutMinutes' } })]);
  const timeoutMinutes = Number(timeoutSetting?.value ?? 2);

  res.json(shelves.map(({ telemetry, device, sensors, _count, ...shelf }) => {
    const reading = telemetry[0] ?? null;
    const lastSeen = device.lastSeen ?? reading?.timestamp ?? null;
    const status = lastSeen && Date.now() - lastSeen.getTime() < timeoutMinutes * 60 * 1000 ? 'ONLINE' : 'OFFLINE';
    return {
      ...shelf,
      currentWeight: reading?.weight ?? null,
      temperature: reading?.temperature ?? null,
      humidity: reading?.humidity ?? null,
      voc: reading?.voc ?? null,
      lastTelemetryAt: reading?.timestamp ?? null,
      utilization: reading ? Math.min(100, reading.weight / shelf.maxCapacity * 100) : null,
      status,
      device: { deviceId: device.deviceId, name: device.name, status, firmware: device.firmware, lastSeen },
      sensors,
      inventoryCount: _count.inventory,
    };
  }));
}));

router.get('/shelves/:shelfId', asyncRoute(async (req, res) => {
  const shelf = await prisma.shelf.findUnique({
    where: { shelfId: String(req.params.shelfId) },
    include: {
      device: true,
      sensors: true,
      telemetry: { orderBy: { timestamp: 'desc' }, take: 720 },
      inventory: { include: { batch: { include: { foodItem: true } }, surplusItem: true } },
    },
  });
  if (!shelf) throw new HttpError(404, 'Shelf not found.');
  const latest = shelf.telemetry[0] ?? null;
  const lastSeen = shelf.device.lastSeen ?? latest?.timestamp ?? null;
  const timeout = await prisma.setting.findUnique({ where: { key: 'deviceTimeoutMinutes' } });
  const timeoutMinutes = Number(timeout?.value ?? 2);

  res.json({
    ...shelf,
    deviceId: shelf.device.deviceId,
    currentWeight: latest?.weight ?? null,
    temperature: latest?.temperature ?? null,
    humidity: latest?.humidity ?? null,
    voc: latest?.voc ?? null,
    gasStatus: latest?.gasStatus ?? null,
    lastTelemetryAt: latest?.timestamp ?? null,
    utilization: latest ? Math.min(100, latest.weight / shelf.maxCapacity * 100) : null,
    status: lastSeen && Date.now() - lastSeen.getTime() < timeoutMinutes * 60 * 1000 ? 'ONLINE' : 'OFFLINE',
    device: { deviceId: shelf.device.deviceId, name: shelf.device.name, firmware: shelf.device.firmware, status: shelf.device.status, lastSeen },
    telemetry: shelf.telemetry.map(({ shelfId, deviceId, ...reading }) => ({
      ...reading,
      shelfId: shelf.shelfId,
      deviceId: shelf.device.deviceId,
      shelfName: shelf.name,
    })),
    inventory: shelf.inventory.map((item) => ({
      id: item.id,
      batchId: item.batch.batchId,
      food: item.batch.foodItem.name,
      category: item.batch.foodItem.category,
      quantity: item.quantity,
      weight: item.weight,
      expiryDate: item.batch.expiryDate,
      rfidTagId: item.batch.rfidTagId,
      status: item.surplusItem ? (item.surplusItem.action ?? 'SURPLUS')
        : item.batch.expiryDate.getTime() < Date.now() ? 'EXPIRED'
          : item.batch.expiryDate.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000 ? 'EXPIRING_SOON'
            : item.status,
    })),
  });
}));

router.post('/shelves', asyncRoute(async (req, res) => {
  const payload = parseInput(createShelfSchema, req.body);
  const device = await prisma.device.findUnique({ where: { deviceId: payload.deviceId } });
  if (!device) throw new HttpError(404, 'The selected device was not found.');

  const shelf = await prisma.shelf.create({
    data: { shelfId: payload.shelfId, name: payload.name, maxCapacity: payload.maxCapacity, deviceId: device.id },
    include: { device: true, sensors: true },
  });
  emitSocketEvent('shelf:update', { action: 'created', shelfId: shelf.shelfId });
  res.status(201).json(shelf);
}));

router.patch('/shelves/:shelfId', asyncRoute(async (req, res) => {
  const payload = parseInput(updateShelfSchema, req.body);
  const { deviceId, ...fields } = payload;
  const data: { name?: string; maxCapacity?: number; deviceId?: string } = {
    ...(fields.name !== undefined ? { name: fields.name } : {}),
    ...(fields.maxCapacity !== undefined ? { maxCapacity: fields.maxCapacity } : {}),
  };
  if (deviceId) {
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) throw new HttpError(404, 'The selected device was not found.');
    data.deviceId = device.id;
  }

  const shelf = await prisma.shelf.update({
    where: { shelfId: String(req.params.shelfId) },
    data,
    include: { device: true, sensors: true },
  });
  emitSocketEvent('shelf:update', { action: 'updated', shelfId: shelf.shelfId });
  res.json(shelf);
}));

router.delete('/shelves/:shelfId', asyncRoute(async (req, res) => {
  const shelf = await prisma.shelf.findUnique({ where: { shelfId: String(req.params.shelfId) } });
  if (!shelf) throw new HttpError(404, 'Shelf not found.');
  const [sensors, inventory, telemetry] = await Promise.all([
    prisma.sensor.count({ where: { shelfId: shelf.id } }),
    prisma.inventoryItem.count({ where: { shelfId: shelf.id } }),
    prisma.telemetry.count({ where: { shelfId: shelf.id } }),
  ]);
  if (sensors || inventory || telemetry) throw new HttpError(409, 'This shelf still has sensors, inventory, or telemetry and cannot be deleted.');

  await prisma.shelf.delete({ where: { id: shelf.id } });
  emitSocketEvent('shelf:update', { action: 'deleted', shelfId: shelf.shelfId });
  res.status(204).end();
}));

export default router;