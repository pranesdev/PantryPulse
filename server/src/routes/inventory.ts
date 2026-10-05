import { Router } from 'express';
import { z } from 'zod';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const createInventorySchema = z.object({
  food: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  batch: z.string().trim().min(1).max(100),
  quantity: z.number().int().nonnegative(),
  weight: z.number().finite().nonnegative(),
  expiryDate: z.coerce.date(),
  shelfId: z.string().trim().min(1),
  rfidTagId: z.string().trim().nullable().optional(),
});
const updateInventorySchema = z.object({
  food: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  quantity: z.number().int().nonnegative().optional(),
  weight: z.number().finite().nonnegative().optional(),
  expiryDate: z.coerce.date().optional(),
  shelfId: z.string().trim().min(1).optional(),
  rfidTagId: z.string().trim().nullable().optional(),
  status: z.enum(['GOOD', 'LOW_STOCK', 'SURPLUS']).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'Provide at least one field to update.');

function computedStatus(expiryDate: Date, savedStatus: string, surplusAction: string | null | undefined) {
  if (surplusAction !== undefined) return surplusAction ?? 'SURPLUS';
  if (expiryDate.getTime() < Date.now()) return 'EXPIRED';
  if (expiryDate.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000) return 'EXPIRING_SOON';
  return savedStatus;
}

router.get('/inventory', asyncRoute(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const shelfId = typeof req.query.shelfId === 'string' && req.query.shelfId !== 'all' ? req.query.shelfId : undefined;
  const category = typeof req.query.category === 'string' && req.query.category !== 'all' ? req.query.category : undefined;
  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(shelfId ? { shelf: { shelfId } } : {}),
      ...(category ? { batch: { foodItem: { category } } } : {}),
      ...(search ? { OR: [
        { batch: { batchId: { contains: search } } },
        { batch: { foodItem: { name: { contains: search } } } },
        { batch: { rfidTagId: { contains: search } } },
      ] } : {}),
    },
    include: { batch: { include: { foodItem: true } }, shelf: true, surplusItem: true },
    orderBy: { addedAt: 'desc' },
  });

  res.json(items.map((item) => ({
    id: item.id,
    food: item.batch.foodItem.name,
    category: item.batch.foodItem.category,
    batch: item.batch.batchId,
    quantity: item.quantity,
    weight: item.weight,
    expiryDate: item.batch.expiryDate,
    shelfId: item.shelf.shelfId,
    shelfName: item.shelf.name,
    status: computedStatus(item.batch.expiryDate, item.status, item.surplusItem?.action),
    rfidTagId: item.batch.rfidTagId,
    addedAt: item.addedAt,
    surplusId: item.surplusItem?.id ?? null,
  })));
}));

router.post('/inventory', asyncRoute(async (req, res) => {
  const payload = parseInput(createInventorySchema, req.body);
  const shelf = await prisma.shelf.findUnique({ where: { shelfId: payload.shelfId } });
  if (!shelf) throw new HttpError(404, 'Shelf not found.');

  const item = await prisma.$transaction(async (transaction) => {
    let foodItem = await transaction.foodItem.findFirst({ where: { name: payload.food, category: payload.category } });
    if (!foodItem) {
      foodItem = await transaction.foodItem.create({ data: { name: payload.food, category: payload.category } });
    }
    const batch = await transaction.batch.create({
      data: {
        batchId: payload.batch,
        foodItemId: foodItem.id,
        quantity: payload.quantity,
        weight: payload.weight,
        expiryDate: payload.expiryDate,
        rfidTagId: payload.rfidTagId ?? null,
      },
    });
    return transaction.inventoryItem.create({
      data: { batchId: batch.id, shelfId: shelf.id, quantity: payload.quantity, weight: payload.weight },
      include: { batch: { include: { foodItem: true } }, shelf: true },
    });
  });

  emitSocketEvent('inventory:update', { action: 'created', id: item.id });
  res.status(201).json({ id: item.id, food: item.batch.foodItem.name, batch: item.batch.batchId, quantity: item.quantity, weight: item.weight, expiryDate: item.batch.expiryDate, shelfId: item.shelf.shelfId });
}));

router.patch('/inventory/:id', asyncRoute(async (req, res) => {
  const payload = parseInput(updateInventorySchema, req.body);
  const current = await prisma.inventoryItem.findUnique({
    where: { id: String(req.params.id) },
    include: { batch: { include: { foodItem: true } } },
  });
  if (!current) throw new HttpError(404, 'Inventory item not found.');

  const item = await prisma.$transaction(async (transaction) => {
    if (payload.food !== undefined || payload.category !== undefined) {
      await transaction.foodItem.update({
        where: { id: current.batch.foodItemId },
        data: {
          ...(payload.food !== undefined ? { name: payload.food } : {}),
          ...(payload.category !== undefined ? { category: payload.category } : {}),
        },
      });
    }
    if (payload.expiryDate !== undefined || payload.rfidTagId !== undefined) {
      await transaction.batch.update({
        where: { id: current.batchId },
        data: {
          ...(payload.expiryDate !== undefined ? { expiryDate: payload.expiryDate } : {}),
          ...(payload.rfidTagId !== undefined ? { rfidTagId: payload.rfidTagId } : {}),
        },
      });
    }

    const shelf = payload.shelfId ? await transaction.shelf.findUnique({ where: { shelfId: payload.shelfId } }) : null;
    if (payload.shelfId && !shelf) throw new HttpError(404, 'Shelf not found.');
    return transaction.inventoryItem.update({
      where: { id: current.id },
      data: {
        ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
        ...(payload.weight !== undefined ? { weight: payload.weight } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(shelf ? { shelfId: shelf.id } : {}),
      },
      include: { batch: { include: { foodItem: true } }, shelf: true, surplusItem: true },
    });
  });

  emitSocketEvent('inventory:update', { action: 'updated', id: item.id });
  res.json({ id: item.id, food: item.batch.foodItem.name, batch: item.batch.batchId, quantity: item.quantity, weight: item.weight, expiryDate: item.batch.expiryDate, shelfId: item.shelf.shelfId, status: computedStatus(item.batch.expiryDate, item.status, item.surplusItem?.action) });
}));

router.delete('/inventory/:id', asyncRoute(async (req, res) => {
  const item = await prisma.inventoryItem.findUnique({ where: { id: String(req.params.id) }, include: { surplusItem: true } });
  if (!item) throw new HttpError(404, 'Inventory item not found.');
  if (item.surplusItem) throw new HttpError(409, 'Resolve the surplus action before deleting this inventory item.');
  await prisma.$transaction(async (transaction) => {
    await transaction.inventoryItem.delete({ where: { id: item.id } });
    const remainingInventory = await transaction.inventoryItem.count({ where: { batchId: item.batchId } });
    if (remainingInventory === 0) {
      const batch = await transaction.batch.delete({ where: { id: item.batchId } });
      const remainingBatches = await transaction.batch.count({ where: { foodItemId: batch.foodItemId } });
      if (remainingBatches === 0) await transaction.foodItem.delete({ where: { id: batch.foodItemId } });
    }
  });
  emitSocketEvent('inventory:update', { action: 'deleted', id: item.id });
  res.status(204).end();
}));

export default router;