import { Router } from 'express';
import { z } from 'zod';
import { emitSocketEvent } from '../sockets/socketServer';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const actionSchema = z.object({ action: z.enum(['DONATION', 'USED', 'DISMISSED']) });

router.get('/surplus', asyncRoute(async (_req, res) => {
  const items = await prisma.surplusItem.findMany({
    include: { inventory: { include: { batch: { include: { foodItem: true } }, shelf: true } } },
    orderBy: { detectedAt: 'desc' },
  });
  res.json(items.map((item) => ({
    id: item.id,
    action: item.action,
    detectedAt: item.detectedAt,
    inventoryId: item.inventoryId,
    food: item.inventory.batch.foodItem.name,
    category: item.inventory.batch.foodItem.category,
    batch: item.inventory.batch.batchId,
    quantity: item.inventory.quantity,
    weight: item.inventory.weight,
    expiryDate: item.inventory.batch.expiryDate,
    shelfId: item.inventory.shelf.shelfId,
    shelfName: item.inventory.shelf.name,
  })));
}));

router.post('/surplus/:inventoryId', asyncRoute(async (req, res) => {
  const inventory = await prisma.inventoryItem.findUnique({ where: { id: String(req.params.inventoryId) } });
  if (!inventory) throw new HttpError(404, 'Inventory item not found.');
  const surplus = await prisma.surplusItem.upsert({
    where: { inventoryId: inventory.id },
    create: { inventoryId: inventory.id },
    update: { action: null },
  });
  await prisma.inventoryItem.update({ where: { id: inventory.id }, data: { status: 'SURPLUS' } });
  emitSocketEvent('surplus:update', surplus);
  res.status(201).json(surplus);
}));

router.patch('/surplus/:id/action', asyncRoute(async (req, res) => {
  const { action } = parseInput(actionSchema, req.body);
  const surplus = await prisma.surplusItem.update({ where: { id: String(req.params.id) }, data: { action } });
  emitSocketEvent('surplus:update', surplus);
  res.json(surplus);
}));

export default router;