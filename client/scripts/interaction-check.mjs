import { chromium } from 'playwright-core';

const baseUrl = process.env.PANTRYPULSE_URL || 'http://localhost:5174';
const apiUrl = process.env.VITE_API_URL || 'http://localhost:4001/api';
const edgePath = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: edgePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());

async function open(route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('main h2', { timeout: 10000 });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await open('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('aside').getByRole('link', { name: 'Shelves' }).click();
  assert(new URL(page.url()).pathname === '/shelves', 'Mobile navigation did not reach Shelves.');
  console.log('PASS mobile drawer navigation');

  await open('/inventory');
  await page.getByRole('textbox', { name: 'Search inventory' }).fill('Apple');
  await page.getByRole('row').filter({ hasText: 'BATCH-001' }).waitFor();
  assert(await page.getByRole('row').filter({ hasText: 'BATCH-002' }).count() === 0, 'Inventory search did not filter unrelated batches.');
  await page.getByRole('textbox', { name: 'Search inventory' }).fill('');
  await page.getByRole('row').filter({ hasText: 'BATCH-002' }).waitFor();
  console.log('PASS inventory search');

  const batchId = `QA-${Date.now()}`;
  await page.getByRole('button', { name: 'Add batch' }).click();
  const inventoryDialog = page.getByRole('dialog');
  await inventoryDialog.locator('input[name="food"]').fill('QA Pear');
  await inventoryDialog.locator('input[name="category"]').fill('QA');
  await inventoryDialog.locator('input[name="batch"]').fill(batchId);
  await inventoryDialog.locator('input[name="quantity"]').fill('2');
  await inventoryDialog.locator('input[name="weight"]').fill('1.5');
  await inventoryDialog.locator('input[name="expiryDate"]').fill('2026-12-25');
  await inventoryDialog.locator('select[name="shelfId"]').selectOption('shelf-A');
  await inventoryDialog.locator('input[name="rfidTagId"]').fill(`QA-RFID-${Date.now()}`);
  await inventoryDialog.getByRole('button', { name: 'Save' }).click();
  const qaRow = page.getByRole('row').filter({ hasText: batchId });
  await qaRow.waitFor();
  await qaRow.getByRole('button', { name: 'Delete QA Pear' }).click();
  await qaRow.waitFor({ state: 'detached' });
  console.log('PASS inventory create/delete');

  const shelfId = `qa-${Date.now()}`;
  await open('/shelves');
  await page.getByRole('button', { name: 'Add Shelf' }).click();
  const shelfDialog = page.getByRole('dialog');
  await shelfDialog.locator('input[name="shelfId"]').fill(shelfId);
  await shelfDialog.locator('input[name="name"]').fill('QA Visual Shelf');
  await shelfDialog.locator('input[name="maxCapacity"]').fill('10');
  await shelfDialog.locator('select[name="deviceId"]').selectOption('PANTRY-ESP32-01');
  await shelfDialog.getByRole('button', { name: 'Add shelf' }).click();
  await page.getByText('QA Visual Shelf').waitFor();
  const cleanupShelf = await fetch(`${apiUrl}/shelves/${encodeURIComponent(shelfId)}`, { method: 'DELETE' });
  assert(cleanupShelf.status === 204, 'Could not clean up QA shelf.');
  console.log('PASS shelf create and cleanup');

  await open('/shelves/shelf-A');
  await page.getByRole('button', { name: 'Edit shelf' }).click();
  const editDialog = page.getByRole('dialog');
  const nameField = editDialog.locator('input[name="name"]');
  const originalName = await nameField.inputValue();
  await nameField.fill(`${originalName} QA`);
  await editDialog.getByRole('button', { name: 'Save shelf' }).click();
  await page.getByRole('heading', { name: `${originalName} QA`, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit shelf' }).click();
  const restoreDialog = page.getByRole('dialog');
  await restoreDialog.locator('input[name="name"]').fill(originalName);
  await restoreDialog.getByRole('button', { name: 'Save shelf' }).click();
  await page.getByRole('heading', { name: originalName, exact: true }).waitFor();
  console.log('PASS shelf edit/revert');

  await open('/alerts');
  const alertCard = page.locator('article').first();
  const readButton = alertCard.getByRole('button', { name: 'Mark read' });
  if (await readButton.count()) {
    await readButton.click();
    await alertCard.getByRole('button', { name: 'Mark unread' }).waitFor();
    await alertCard.getByRole('button', { name: 'Mark unread' }).click();
    await alertCard.getByRole('button', { name: 'Mark read' }).waitFor();
  }
  console.log('PASS alert read/unread');

  await open('/settings');
  const vocField = page.locator('input[type="number"]').nth(2);
  const originalVoc = await vocField.inputValue();
  await vocField.fill(String(Number(originalVoc) + 1));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('status').filter({ hasText: 'Settings saved.' }).waitFor();
  const restoreSetting = await fetch(`${apiUrl}/settings/maxVOC`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: originalVoc }),
  });
  assert(restoreSetting.ok, 'Could not restore the test VOC threshold.');
  console.log('PASS settings save/revert');

  const deviceId = `QA-ESP32-${Date.now()}`;
  await open('/devices');
  await page.getByRole('button', { name: 'Register device' }).click();
  const deviceDialog = page.getByRole('dialog');
  await deviceDialog.locator('input[name="deviceId"]').fill(deviceId);
  await deviceDialog.locator('input[name="name"]').fill('QA Visual Device');
  await deviceDialog.getByRole('button', { name: 'Register' }).click();
  const deviceCard = page.locator('article').filter({ hasText: deviceId });
  await deviceCard.waitFor();
  await deviceCard.getByRole('button', { name: 'Delete' }).click();
  await deviceCard.waitFor({ state: 'detached' });
  console.log('PASS device register/delete');
} finally {
  await browser.close();
}

console.log(`Page errors: ${JSON.stringify(errors)}`);
if (errors.length) process.exitCode = 1;