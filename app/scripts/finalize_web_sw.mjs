import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const outputDir = new URL('../dist-web/', import.meta.url);
const serviceWorkerPath = new URL('sw.js', outputDir);
const appHtmlPath = new URL('index.html', outputDir);
const runDirectory = new URL('run/', outputDir);
const runHtmlPath = new URL('run/index.html', outputDir);
const installerHtmlPath = new URL('install.html', outputDir);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

await mkdir(runDirectory, { recursive: true });
await rename(appHtmlPath, runHtmlPath);
await writeFile(appHtmlPath, await readFile(installerHtmlPath, 'utf8'));
await unlink(installerHtmlPath);

const outputPath = outputDir.pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1));
const files = (await listFiles(outputPath))
  .filter((file) => !file.endsWith(`${sep}sw.js`))
  .map((file) => `./${relative(outputPath, file).split(sep).join('/')}`)
  .sort();

const precache = ['./', ...files];
const template = await readFile(serviceWorkerPath, 'utf8');
const digest = createHash('sha256')
  .update(JSON.stringify(precache))
  .update(template)
  .digest('hex')
  .slice(0, 12);
const finalized = template
  .replace('__FURILOG_CACHE_NAME__', `furilog-web-${digest}`)
  .replace('__FURILOG_PRECACHE__', JSON.stringify(precache, null, 2));

if (finalized.includes('__FURILOG_')) throw new Error('Service worker placeholders were not finalized.');
await writeFile(serviceWorkerPath, finalized);
