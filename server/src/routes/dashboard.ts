import { Router } from 'express';
import { asyncRoute, parseRange } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

function serializeInventory(item: {
  id: string;
  quantity: number;
  weight: number;
  status: string;
  addedAt: Date;
  batch: { batchId: string; expiryDate: Date; rfidTagId: string | null; foodItem: { name: string; category: string } };
  shelf: { shelfId: string; name: string };
  surplusItem: { id: string; action: string | null } | null;
}) {
  const now = Date.now();
  const expiryTime = item.batch.expiryDate.getTime();
  const status = item.surplusItem ? (item.surplusItem.action ? item.surplusItem.action : 'SURPLUS')
    : expiryTime < now ? 'EXPIRED'
      : expiryTime < now + sevenDaysMs ? 'EXPIRING_SOON'
        : item.status;

  return {
    id: item.id,
    food: item.batch.foodItem.name,
    category: item.batch.foodItem.category,
    batch: item.batch.batchId,
    quantity: item.quantity,
    weight: item.weight,
    expiryDate: item.batch.expiryDate,
    shelfId: item.shelf.shelfId,
    shelfName: item.shelf.name,
    status,
    rfidTagId: item.batch.rfidTagId,
    addedAt: item.addedAt,
    surplusId: item.surplusItem?.id ?? null,
  };
}

router.get('/dashboard', asyncRoute(async (req, res) => {
  const { range, since } = parseRange(req.query.range);
  const shelfFilter = typeof req.query.shelfId === 'string' && req.query.shelfId !== 'all'
    ? req.query.shelfId
    : undefined;

  const [shelves, devices, rawInventory, rawAlerts, rawSurplus, settings, history] = await Promise.all([
    prisma.shelf.findMany({
      ...(shelfFilter ? { where: { shelfId: shelfFilter } } : {}),
      include: {
        device: true,
        sensors: true,
        telemetry: { orderBy: { timestamp: 'desc' }, take: 1 },
        _count: { select: { inventory: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.device.findMany({ include: { shelves: true, telemetries: { orderBy: { timestamp: 'desc' }, take: 1 } }, orderBy: { name: 'asc' } }),
    prisma.inventoryItem.findMany({ include: { batch: { include: { foodItem: true } }, shelf: true, surplusItem: true }, orderBy: { addedAt: 'desc' } }),
    prisma.alert.findMany({ where: { resolved: false }, orderBy: { timestamp: 'desc' }, take: 100 }),
    prisma.surplusItem.findMany({ where: { action: null } }),
    prisma.setting.findMany({ orderBy: { key: 'asc' } }),
    prisma.telemetry.findMany({
      where: {
        timestamp: { gte: since },
        ...(shelfFilter ? { shelf: { shelfId: shelfFilter } } : {}),
      },
      include: { shelf: true },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    }),
  ]);

  const latestReadings = shelves.flatMap((shelf) => shelf.telemetry.map((reading) => ({
    weight: reading.weight,
    temperature: reading.temperature,
    humidity: reading.humidity,
    voc: reading.voc,
    timestamp: reading.timestamp,
  })));
  const average = (key: 'temperature' | 'humidity' | 'voc') => latestReadings.length
    ? latestReadings.reduce((total, reading) => total + reading[key], 0) / latestReadings.length
    : null;
  const totalWeight = latestReadings.reduce((total, reading) => total + reading.weight, 0);
  const totalCapacity = shelves.reduce((total, shelf) => total + shelf.maxCapacity, 0);
  const inventory = rawInventory.map(serializeInventory);
  const now = Date.now();
  const timeoutSetting = settings.find((setting) => setting.key === 'deviceTimeoutMinutes');
  const timeoutMinutes = Number(timeoutSetting?.value ?? 2);
  const deviceData = devices.map(({ telemetries, shelves: deviceShelves, ...device }) => {
    const lastTelemetry = telemetries[0];
    const lastSeen = device.lastSeen ?? lastTelemetry?.timestamp ?? null;
    const isOnline = Boolean(lastSeen && now - lastSeen.getTime() < timeoutMinutes * 60 * 1000);
    return {
      ...device,
      lastSeen,
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      shelfIds: deviceShelves.map((shelf) => shelf.shelfId),
    };
  });

  const shelfData = shelves.map(({ telemetry, device, sensors, _count, ...shelf }) => {
    const reading = telemetry[0] ?? null;
    const lastSeen = device.lastSeen ?? reading?.timestamp ?? null;
    return {
      ...shelf,
      currentWeight: reading?.weight ?? null,
      temperature: reading?.temperature ?? null,
      humidity: reading?.humidity ?? null,
      voc: reading?.voc ?? null,
      gasStatus: reading?.gasStatus ?? null,
      lastTelemetryAt: reading?.timestamp ?? null,
      utilization: reading ? Math.min(100, reading.weight / shelf.maxCapacity * 100) : null,
      status: lastSeen && now - lastSeen.getTime() < timeoutMinutes * 60 * 1000 ? 'ONLINE' : 'OFFLINE',
      device: { deviceId: device.deviceId, name: device.name, status: device.status, firmware: device.firmware, lastSeen },
      sensors,
      inventoryCount: _count.inventory,
    };
  });

  const shelfNames = new Map(shelves.map((shelf) => [shelf.id, shelf.name]));
  const deviceNames = new Map(devices.map((device) => [device.id, device.name]));
  const alerts = rawAlerts.map((alert) => ({
    ...alert,
    shelfName: alert.shelfId ? shelfNames.get(alert.shelfId) ?? null : null,
    deviceName: alert.deviceId ? deviceNames.get(alert.deviceId) ?? null : null,
  }));

  res.json({
    generatedAt: new Date().toISOString(),
    range,
    demoMode: process.env.DEMO_MODE === 'true' || settings.some((setting) => setting.key === 'demoMode' && setting.value === 'true'),
    metrics: {
      totalWeight,
      totalCapacity,
      utilization: totalCapacity ? totalWeight / totalCapacity * 100 : null,
      temperature: average('temperature'),
      humidity: average('humidity'),
      voc: average('voc'),
      inventoryCount: inventory.length,
      expiringSoon: inventory.filter((item) => item.status === 'EXPIRING_SOON').length,
      expiredItems: inventory.filter((item) => item.status === 'EXPIRED').length,
      surplusItems: rawSurplus.length,
      activeAlerts: alerts.length,
      onlineDevices: deviceData.filter((device) => device.status === 'ONLINE').length,
      deviceCount: deviceData.length,
    },
    shelves: shelfData,
    devices: deviceData,
    inventory,
    alerts,
    surplus: rawSurplus.length,
    settings: settings.map(({ key, value }) => ({ key, value })),
    telemetry: history.map(({ shelf, ...record }) => ({ ...record, shelfId: shelf.shelfId, shelfName: shelf.name })),
  });
}));

export default router;