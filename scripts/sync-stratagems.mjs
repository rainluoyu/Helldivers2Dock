import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = 'https://helldivers.wiki.gg';
const SOURCE_PAGE = `${BASE_URL}/wiki/Stratagems`;
const API_URL = `${BASE_URL}/api.php?action=parse&page=Stratagems&prop=text&format=json&formatversion=2`;
const REVISION_API_URL = `${BASE_URL}/api.php?action=query&titles=Stratagems&prop=revisions&rvprop=ids%7Ctimestamp&format=json&formatversion=2`;
const PLUGIN_ID = 'com.n4pro.helldivers2dock';
const ASSET_ROOT = path.resolve('assets');
const ACTIONS_DIR = path.join(ASSET_ROOT, 'images', 'actions');
const ORIGINALS_DIR = path.join(ASSET_ROOT, 'images', 'wiki-original');
const DATA_DIR = path.resolve('data');
const STATIC_DIR = path.join(ASSET_ROOT, 'static');

const response = await fetchWithRetry(API_URL, {
  headers: { 'User-Agent': 'Helldivers2Dock/1.1 (static data synchronization)' }
});
if (!response.ok) {
  throw new Error(`wiki.gg API returned HTTP ${response.status}`);
}
const payload = await response.json();
const html = payload.parse?.text;
if (!html) {
  throw new Error('wiki.gg API response did not include rendered Stratagems HTML');
}
const revisionResponse = await fetchWithRetry(REVISION_API_URL, {
  headers: { 'User-Agent': 'Helldivers2Dock/1.1 (revision synchronization)' }
});
if (!revisionResponse.ok) {
  throw new Error(`wiki.gg revision API returned HTTP ${revisionResponse.status}`);
}
const revisionPayload = await revisionResponse.json();
const revision = revisionPayload.query?.pages?.[0]?.revisions?.[0];
if (!revision?.revid) {
  throw new Error('wiki.gg revision API response did not include a revision ID');
}

await Promise.all([
  mkdir(ACTIONS_DIR, { recursive: true }),
  mkdir(ORIGINALS_DIR, { recursive: true }),
  mkdir(DATA_DIR, { recursive: true }),
  mkdir(STATIC_DIR, { recursive: true })
]);

const tableMatches = [...html.matchAll(/<table class="wikitable sortable"[\s\S]*?<\/table>/g)];
const stratagems = [];

for (const tableMatch of tableMatches) {
  const beforeTable = html.slice(0, tableMatch.index);
  const summaries = [...beforeTable.matchAll(/<summary>([^<]+)<\/summary>/g)];
  const category = decodeHtml(summaries.at(-1)?.[1] ?? 'Other');
  const rows = [...tableMatch[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1);

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    if (cells.length < 3) continue;

    const name = decodeHtml(stripTags(cells[1])).trim();
    const pageHref = cells[1].match(/href="([^"]+)"/)?.[1];
    const iconSrc = cells[0].match(/<img[^>]*src="([^"]+)"/)?.[1];
    const directions = [...cells[2].matchAll(/Stratagem Arrow (Up|Down|Left|Right)/g)].map((match) => match[1]);
    if (!name || !pageHref || !iconSrc || directions.length === 0) continue;

    const slug = toSlug(name);
    const iconUrl = new URL(decodeHtml(iconSrc), BASE_URL);
    iconUrl.search = '';
    const originalExtension = path.extname(iconUrl.pathname).toLowerCase() || '.img';
    const originalRelative = `images/wiki-original/${slug}${originalExtension}`;
    const actionRelative = `images/actions/${slug}.png`;

    stratagems.push({
      name,
      slug,
      uuid: `${PLUGIN_ID}.${slug}`,
      category,
      code: directions.map((direction) => direction[0]).join(''),
      arrows: directions.map((direction) => ({ Up: '↑', Down: '↓', Left: '←', Right: '→' })[direction]).join(' '),
      icon: actionRelative,
      originalIcon: originalRelative,
      iconSource: iconUrl.toString(),
      page: new URL(decodeHtml(pageHref), BASE_URL).toString()
    });
  }
}

const duplicates = findDuplicates(stratagems.map((item) => item.slug));
if (duplicates.length) {
  throw new Error(`Duplicate generated slugs: ${duplicates.join(', ')}`);
}
if (stratagems.length < 100) {
  throw new Error(`Only found ${stratagems.length} stratagems; refusing to replace the catalog`);
}

let completed = 0;
await runLimited(stratagems, 4, async (item) => {
  const iconResponse = await fetchWithRetry(item.iconSource, {
    headers: { 'User-Agent': 'Helldivers2Dock/1.1 (icon synchronization)' }
  });
  if (!iconResponse.ok) {
    throw new Error(`Failed to download ${item.name}: HTTP ${iconResponse.status}`);
  }
  const originalPath = path.join(ASSET_ROOT, item.originalIcon);
  const pngPath = path.join(ASSET_ROOT, item.icon);
  await writeFile(originalPath, Buffer.from(await iconResponse.arrayBuffer()));
  convertToPng(originalPath, pngPath);
  completed += 1;
  process.stdout.write(`\rDownloaded and rendered ${completed}/${stratagems.length} icons`);
});
process.stdout.write('\n');

const retrievedAt = new Date().toISOString();
const catalog = {
  pluginId: PLUGIN_ID,
  source: SOURCE_PAGE,
  sourceRevision: revision.revid,
  sourceRevisionTimestamp: revision.timestamp,
  retrievedAt,
  count: stratagems.length,
  controls: { modifier: 'Left Ctrl', directions: 'W/A/S/D', preInputDelayMs: 45, keyIntervalMs: 8 },
  stratagems
};
await writeJson(path.join(DATA_DIR, 'stratagems.json'), catalog);

const reinforce = stratagems.find((item) => item.slug === 'reinforce') ?? stratagems[0];
await writeFile(path.join(STATIC_DIR, 'plugin-icon.png'), await readFile(path.join(ASSET_ROOT, reinforce.icon)));

console.log(`Cataloged ${stratagems.length} stratagems from wiki revision ${revision.revid}.`);

function convertToPng(source, destination) {
  const result = spawnSync('magick', [source, '-background', 'none', '-resize', '288x288', '-gravity', 'center', '-extent', '288x288', destination], {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed for ${source}: ${result.stderr || result.stdout}`);
  }
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body) => {
    if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return named[body.toLowerCase()] ?? entity;
  });
}

function toSlug(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

async function runLimited(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }));
}

async function fetchWithRetry(url, options, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${attempts} attempts`, { cause: lastError });
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
