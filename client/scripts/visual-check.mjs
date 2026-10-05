import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.PANTRYPULSE_URL || 'http://localhost:5174';
const edgePath = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const routes = ['/', '/dashboard', '/shelves', '/inventory', '/alerts', '/reports', '/devices', '/settings'];
const widths = [1440, 1280, 1024, 768, 390, 375];
const screenshots = path.join(os.tmpdir(), 'pantrypulse-visual-check');
const failures = [];

await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: edgePath, args: ['--no-sandbox'] });
const page = await browser.newPage();
let activeRoute = '';

page.on('pageerror', (error) => failures.push(`${activeRoute}: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') failures.push(`${activeRoute}: ${message.text()}`);
});

for (const width of widths) {
  await page.setViewportSize({ width, height: 900 });

  for (const route of routes) {
    activeRoute = `${width}px ${route}`;

    try {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForSelector('main h2', { timeout: 10000 });
      const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        title: document.querySelector('main h2')?.textContent?.trim() ?? '',
        charts: document.querySelectorAll('svg.recharts-surface').length,
        background: getComputedStyle(document.querySelector('#root')).backgroundColor,
      }));
      const screenshotName = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
      await page.screenshot({
        path: path.join(screenshots, `${screenshotName}-${width}.png`),
        animations: 'disabled',
      });

      console.log(`${response?.status() ?? 'no response'} ${activeRoute} ${JSON.stringify(layout)}`);
      if (!response?.ok()) failures.push(`${activeRoute}: HTTP ${response?.status()}`);
      if (layout.documentWidth > width) failures.push(`${activeRoute}: horizontal overflow ${layout.documentWidth}px`);
      if (!layout.title) failures.push(`${activeRoute}: page heading is missing`);
    } catch (error) {
      failures.push(`${activeRoute}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await browser.close();
console.log(`Screenshots: ${screenshots}`);
console.log(`Failures: ${JSON.stringify(failures)}`);
if (failures.length) process.exitCode = 1;