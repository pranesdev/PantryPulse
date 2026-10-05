import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, HttpError, parseInput } from '../services/http';
import { prisma } from '../services/prisma';

const router = Router();
const scanSchema = z.object({ rfidTagId: z.string().trim().min(1).max(200) });

async function findTag(rfidTagId: string) {
  const batch = await prisma.batch.findFirst({
    where: { rfidTagId },
    include: { foodItem: true, inventory: { include: { shelf: true, surplusItem: true } } },
  });
  if (!batch) throw new HttpError(404, 'No food batch is linked to this RFID tag.');
  return {
    rfidTagId,
    batch: batch.batchId,
    food: batch.foodItem.name,
    category: batch.foodItem.category,
    quantity: batch.quantity,
    weight: batch.weight,
    expiryDate: batch.expiryDate,
    inventory: batch.inventory.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      weight: item.weight,
      shelfId: item.shelf.shelfId,
      shelfName: item.shelf.name,
      surplus: Boolean(item.surplusItem && !item.surplusItem.action),
    })),
  };
}

router.post('/rfid/scan', asyncRoute(async (req, res) => {
  const { rfidTagId } = parseInput(scanSchema, req.body);
  res.json(await findTag(rfidTagId));
}));

router.get('/rfid/:rfidTagId', asyncRoute(async (req, res) => {
  res.json(await findTag(String(req.params.rfidTagId)));
}));

export default router;