import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const settings = [
    { key: 'demoMode', value: process.env.DEMO_MODE === 'true' ? 'true' : 'false' },
    { key: 'maxTemperature', value: '30' },
    { key: 'maxHumidity', value: '70' },
    { key: 'maxVOC', value: '300' },
    { key: 'deviceTimeoutMinutes', value: '2' },
    { key: 'maxWeightPercent', value: '85' },
    { key: 'alertsEnabled', value: 'true' },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({ where: { key: setting.key }, create: setting, update: {} });
  }

  const device1 = await prisma.device.upsert({
    where: { deviceId: 'PANTRY-ESP32-01' },
    update: {},
    create: { deviceId: 'PANTRY-ESP32-01', name: 'PantryPulse Controller 01', ipAddress: '192.168.1.101', firmware: 'demo' },
  });
  const device2 = await prisma.device.upsert({
    where: { deviceId: 'PANTRY-ESP32-02' },
    update: {},
    create: { deviceId: 'PANTRY-ESP32-02', name: 'PantryPulse Controller 02', ipAddress: '192.168.1.102', firmware: 'demo' },
  });

  const shelfInputs = [
    { shelfId: 'shelf-A', name: 'Shelf A', maxCapacity: 50, deviceId: device1.id },
    { shelfId: 'shelf-B', name: 'Shelf B', maxCapacity: 60, deviceId: device1.id },
    { shelfId: 'shelf-C', name: 'Shelf C', maxCapacity: 55, deviceId: device2.id },
  ];
  const [shelfA, shelfB, shelfC] = await Promise.all(shelfInputs.map((shelf) =>
    prisma.shelf.upsert({ where: { shelfId: shelf.shelfId }, create: shelf, update: {} })
  ));
  if (!shelfA || !shelfB || !shelfC) throw new Error('Demo shelves could not be initialized.');
  const shelves = [shelfA, shelfB, shelfC];

  for (const shelf of shelves) {
    for (const type of ['HX711', 'DHT22', 'MQ', 'RFID']) {
      const sensor = await prisma.sensor.findFirst({ where: { shelfId: shelf.id, type } });
      if (!sensor) await prisma.sensor.create({ data: { shelfId: shelf.id, type } });
    }
  }

  const demoInventory = [
    { name: 'Apple', category: 'Fruit', batchId: 'BATCH-001', quantity: 20, weight: 10, daysToExpiry: 5, shelf: shelfA, rfidTagId: 'PP-APPLE-001' },
    { name: 'Bread', category: 'Bakery', batchId: 'BATCH-002', quantity: 15, weight: 7.5, daysToExpiry: 2, shelf: shelfB, rfidTagId: 'PP-BREAD-002' },
    { name: 'Cheese', category: 'Dairy', batchId: 'BATCH-003', quantity: 8, weight: 4, daysToExpiry: -1, shelf: shelfC, rfidTagId: 'PP-CHEESE-003' },
  ];

  for (const entry of demoInventory) {
    const foodItem = await prisma.foodItem.findFirst({ where: { name: entry.name, category: entry.category } })
      ?? await prisma.foodItem.create({ data: { name: entry.name, category: entry.category } });
    const batch = await prisma.batch.upsert({
      where: { batchId: entry.batchId },
      create: {
        batchId: entry.batchId,
        foodItemId: foodItem.id,
        quantity: entry.quantity,
        weight: entry.weight,
        expiryDate: addDays(new Date(), entry.daysToExpiry),
        rfidTagId: entry.rfidTagId,
      },
      update: {},
    });
    let inventory = await prisma.inventoryItem.findFirst({ where: { batchId: batch.id, shelfId: entry.shelf.id } });
    if (!inventory) {
      inventory = await prisma.inventoryItem.create({
        data: {
          batchId: batch.id,
          shelfId: entry.shelf.id,
          quantity: entry.quantity,
          weight: entry.weight,
          status: entry.batchId === 'BATCH-003' ? 'SURPLUS' : 'GOOD',
        },
      });
    }
    if (entry.batchId === 'BATCH-003') {
      await prisma.surplusItem.upsert({
        where: { inventoryId: inventory.id },
        create: { inventoryId: inventory.id },
        update: {},
      });
    }
  }

  if (await prisma.telemetry.count() === 0) {
    const telemetry = [];
    const now = Date.now();
    for (let hour = 30 * 24; hour >= 0; hour -= 4) {
      const timestamp = new Date(now - hour * 60 * 60 * 1000);
      for (const [index, shelf] of shelves.entries()) {
        const phase = (30 * 24 - hour) / 5 + index;
        const weight = shelf.maxCapacity * (0.35 + 0.04 * Math.sin(phase));
        const temperature = 4.2 + 0.3 * Math.sin(phase / 2);
        const humidity = 60 + 4 * Math.sin(phase / 3);
        const voc = 42 + 9 * Math.max(0, Math.sin(phase / 4));
        telemetry.push({
          deviceId: shelf.deviceId,
          shelfId: shelf.id,
          weight,
          temperature,
          humidity,
          voc,
          gasStatus: 'NORMAL',
          timestamp,
        });
      }
    }
    await prisma.telemetry.createMany({ data: telemetry });
    await prisma.device.updateMany({ where: { id: { in: [device1.id, device2.id] } }, data: { lastSeen: new Date(), status: 'ONLINE' } });
  }

  if (await prisma.alert.count() === 0) {
    await prisma.alert.create({
      data: {
        type: 'HUMIDITY',
        severity: 'WARNING',
        shelfId: shelfB.id,
        deviceId: device1.id,
        description: 'Demo alert: humidity exceeded its configured range.',
      },
    });
  }

  console.log('PantryPulse seed complete; existing records were preserved.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
