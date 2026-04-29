import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.json': 'application/json'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = resolve(root, `.${requestPath}`);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const gameUrl = `http://127.0.0.1:${port}/index.html`;

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop-720', width: 1280, height: 720 },
  { name: 'desktop-1080', width: 1920, height: 1080 }
];

const seeds = [424242, 8675309];

const browser = await chromium.launch({ headless: true });
const failures = [];
const artifactDir = resolve(tmpdir(), 'shred-or-dead-qa');
await mkdir(artifactDir, { recursive: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', err => failures.push(`${viewport.name}: ${err.message}`));
    await page.goto(gameUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => window.ShredQA && document.querySelector('#gameCanvas'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: resolve(artifactDir, `${viewport.name}-menu.png`) });

    for (const seed of seeds) {
      await page.evaluate(({ seed }) => {
        window.ShredQA.start({ seed, map: 'classic' });
        window.ShredQA.step(15);
      }, { seed });
      if (seed === seeds[0]) {
        await page.screenshot({ path: resolve(artifactDir, `${viewport.name}-gameplay.png`) });
      }

      const state = await page.evaluate(() => window.ShredQA.state());
      const sample = await page.evaluate(() => window.ShredQA.canvasSample());
      if (state.screen !== 'playing') failures.push(`${viewport.name} seed ${seed}: run ended before 15s (${state.screen})`);
      if (state.distance < 20) failures.push(`${viewport.name} seed ${seed}: distance did not advance (${state.distance})`);
      if (sample.nonBlankRatio < 0.7) failures.push(`${viewport.name} seed ${seed}: canvas looks blank (${sample.nonBlankRatio.toFixed(2)})`);
    }

    await page.evaluate(() => {
      window.ShredQA.start({ seed: 112233, map: 'classic', daily: true });
      window.ShredQA.step(2);
    });
    const dailyDuring = await page.evaluate(() => window.ShredQA.state());
    await page.evaluate(() => window.ShredQA.start({ seed: 112233, map: 'classic', daily: false }));
    const dailyAfter = await page.evaluate(() => window.ShredQA.state());
    if (!dailyDuring.dailyActive) failures.push(`${viewport.name}: daily modifier did not activate`);
    if (dailyAfter.dailyActive) failures.push(`${viewport.name}: daily modifier leaked into normal run`);

    await page.evaluate(() => {
      window.ShredQA.forceGameOver('tree');
    });
    await page.screenshot({ path: resolve(artifactDir, `${viewport.name}-gameover.png`) });

    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

if (failures.length) {
  console.error('QA smoke failures:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`QA smoke passed for mobile, 720p, 1080p, daily reset, and 15-second survivability. Screenshots: ${artifactDir}`);
