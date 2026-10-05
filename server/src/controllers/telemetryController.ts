import type { Alert } from '@prisma/client';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const telemetrySchema = z.object({
  deviceId: z.string().trim().min(1),
  shelfId: z.string().trim().min(1),
  weight: z.number().finite().nonnegative().optional(),
  weightKg: z.number().finite().nonnegative().optional(),
  temperature: z.number().finite(),
  humidity: z.number().finite().min(0).max(100),
  voc: z.number().finite().nonnegative(),
  gasStatus: z.string().trim().min(1).optional(),
  timestamp: z.coerce.date().optional(),
}).refine((payload) => payload.weight !== undefined || payload.weightKg !== undefined, {
  message: 'weight or weightKg is required',
});

export const handleTelemetry: RequestHandler = asyncRoute(async (req, res) => {
  const payload = parseInput(telemetrySchema, req.body);
  const weight = payload.weight ?? payload.weightKg!;

  const result = await prisma.$transaction(async (transaction) => {
    const device = await transaction.device.findUnique({ where: { deviceId: payload.deviceId } });
    if (!device) throw new HttpError(404, 'The device is not registered.');

    const shelf = await transaction.shelf.findUnique({ where: { shelfId: payload.shelfId } });
    if (!shelf) throw new HttpError(404, 'The shelf is not registered.');
    if (shelf.deviceId !== device.id) throw new HttpError(409, 'The shelf is assigned to a different device.');

    const telemetry = await transaction.telemetry.create({
      data: {
        deviceId: device.id,
        shelfId: shelf.id,
        weight,
        temperature: payload.temperature,
        humidity: payload.humidity,
        voc: payload.voc,
        gasStatus: payload.gasStatus ?? 'UNKNOWN',
        timestamp: payload.timestamp ?? new Date(),
      },
    });
    const updatedDevice = await transaction.device.update({
      where: { id: device.id },
      data: { lastSeen: new Date(), status: 'ONLINE' },
    });

    const savedSettings = await transaction.setting.findMany();
    const settingValues = new Map(savedSettings.map((setting) => [setting.key, setting.value]));
    const thresholds = [
      { type: 'TEMPERATURE', severity: 'WARNING', value: payload.temperature, key: 'maxTemperature', fallback: 30, message: 'Temperature exceeded configured maximum.' },
      { type: 'HUMIDITY', severity: 'WARNING', value: payload.humidity, key: 'maxHumidity', fallback: 70, message: 'Humidity exceeded configured maximum.' },
      { type: 'VOC', severity: 'CRITICAL', value: payload.voc, key: 'maxVOC', fallback: 300, message: 'VOC level exceeded configured maximum.' },
      { type: 'WEIGHT', severity: 'WARNING', value: weight / shelf.maxCapacity * 100, key: 'maxWeightPercent', fallback: 85, message: 'Shelf capacity exceeded configured maximum.' },
    ];

    const createdAlerts: Alert[] = [];
    if ((settingValues.get('alertsEnabled') ?? 'true') === 'true') {
      for (const threshold of thresholds) {
        const maximum = Number(settingValues.get(threshold.key) ?? threshold.fallback);
        if (!Number.isFinite(maximum) || threshold.value <= maximum) continue;

        const existing = await transaction.alert.findFirst({
          where: { type: threshold.type, shelfId: shelf.id, resolved: false },
        });
        if (existing) continue;

        createdAlerts.push(await transaction.alert.create({
          data: {
            type: threshold.type,
            severity: threshold.severity,
            description: threshold.message,
            shelfId: shelf.id,
            deviceId: device.id,
          },
        }));
      }
    }

    return { telemetry, device: updatedDevice, shelf, createdAlerts };
  });

  const response = {
    ...result.telemetry,
    deviceId: result.device.deviceId,
    shelfId: result.shelf.shelfId,
    device: { deviceId: result.device.deviceId, status: result.device.status, lastSeen: result.device.lastSeen },
    shelf: { shelfId: result.shelf.shelfId, name: result.shelf.name },
    alerts: result.createdAlerts,
  };

  emitSocketEvent('telemetry:update', response);
  emitSocketEvent('device:update', response.device);
  for (const alert of result.createdAlerts) emitSocketEvent('alert:update', alert);

  res.status(201).json(response);
});
