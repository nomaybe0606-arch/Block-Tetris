import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, relative, extname, sep } from 'node:path';

const root = resolve('dist');
const base = process.argv[2] ?? '/Block-Tetris/';
assert(base === '/Block-Tetris/' || base === './', 'Expected /Block-Tetris/ or ./');
const mount = base === './' ? '/' : base;
const origin = 'http://127.0.0.1';
const documentUrl = new URL(mount, origin);
const html = readFileSync(join(root, 'index.html'), 'utf8');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? files(path) : [path];
});
const relativeUrl = path => relative(root, path).split(sep).join('/');
function localPath(url) {
  const parsed = new URL(url, documentUrl);
  assert.equal(parsed.origin, origin, `Unexpected external asset: ${url}`);
  assert(parsed.pathname.startsWith(mount), `Asset escapes deployment prefix: ${url}`);
  const path = resolve(root, decodeURIComponent(parsed.pathname.slice(mount.length)));
  assert(path.startsWith(root + sep), `Asset escapes dist: ${url}`);
  return path;
}

const entryUrls = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), match => match[1]);
for (const url of entryUrls) {
  if (base === './') assert(url.startsWith('./'), `Portable URL must be relative: ${url}`);
  assert(existsSync(localPath(url)), `Missing entry asset: ${url}`);
}
assert(entryUrls.includes(`${base}playgama-bridge.js`), 'Bridge script must use the deployment base');

// Compare every public file byte for byte, including both audio formats, config and licenses.
for (const source of files(resolve('public'))) {
  const built = join(root, relative(resolve('public'), source));
  assert(existsSync(built), `Missing public asset: ${source}`);
  assert(readFileSync(source).equals(readFileSync(built)), `Changed public asset: ${source}`);
}
const configUrl = new URL('./playgama-bridge-config.json', documentUrl);
const config = JSON.parse(readFileSync(localPath(configUrl.href), 'utf8'));
assert.equal(config.advertisement.minimumDelayBetweenInterstitial, 60);
assert.equal(config.disableLoadingLogo, true, 'Bridge branding must be disabled officially');
assert.equal(config.loadingScreenType, 'none', 'Use only the Grid Pulse loading screen');
assert.equal(config.advertisement.rewarded.placementFallback, 'piece_swap');
assert(config.advertisement.rewarded.placements.some(placement => placement.id === 'piece_swap'));
for (const name of ['ambient', 'pick', 'place', 'clear', 'combo', 'record', 'ui']) {
  const ogg = readFileSync(join(root, `assets/audio/${name}.ogg`));
  assert.equal(ogg.toString('ascii', 0, 4), 'OggS');
  assert(ogg.length > 1000);
  const mp3 = readFileSync(join(root, `assets/audio/${name}.mp3`));
  assert(mp3.length > 1000);
  assert(mp3.toString('ascii', 0, 3) === 'ID3' || mp3[0] === 255);
}

const scripts = files(join(root, 'assets')).filter(path => path.endsWith('.js'));
const appCode = scripts.map(path => readFileSync(path, 'utf8')).join('\n');
assert(!/GRID_PULSE_DEV_REWARDED_ONLY|DevRewardedPlatform|DEV SDK error/.test(appCode), 'DEV rewarded mock leaked into production');
assert(!scripts.some(path => path.includes('DevRewarded')), 'DEV rewarded chunk leaked into production');
assert(!appCode.includes('happy-dom'), 'DOM test environment leaked into production');
assert(!/grid-pulse-perf|GRID_PULSE_DEV_PERF_ONLY|DEV PERF/.test(appCode), 'DEV performance diagnostics leaked into production');
assert(!scripts.some(path => path.includes('PerfDiagnostics')), 'DEV performance chunk leaked into production');
assert(!appCode.includes('GRID_PULSE_DEV_TRAY_ONLY')&&!scripts.some(path => path.includes('trayFixture')), 'DEV tray fixture leaked into production');
assert(appCode.includes(`${base}assets/audio/ambient.`), 'Music URL does not use BASE_URL');
assert(appCode.includes(`${base}assets/audio/`), 'Effect URLs do not use BASE_URL');
// Validate emitted module references relative to the chunk that imports them.
for (const script of scripts) {
  const code = readFileSync(script, 'utf8');
  const scriptUrl = new URL(relativeUrl(script), documentUrl);
  for (const [, url] of code.matchAll(/["'`]((?:\.\/|\.\.\/)[^"'`\s]+\.(?:js|css))["'`]/g)) {
    assert(existsSync(localPath(new URL(url, scriptUrl).href)), `Missing chunk dependency: ${url}`);
  }
}

for (const path of files('src').filter(path => /\.(ts|css)$/.test(path))) {
  const text = readFileSync(path, 'utf8');
  assert(!/localStorage|indexedDB|document\.cookie/.test(text), `Direct persistence in ${path}`);
  assert(!/\bTODO\b/.test(text), `Unfinished implementation in ${path}`);
}

// Strict HTTP mount: no SPA fallback. A wrong root /assets/ path must return 404.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = createServer((request, response) => {
  try {
    const url = new URL(request.url, origin);
    const path = localPath(url.pathname === mount ? `${mount}index.html` : url.href);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(readFileSync(path));
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const httpOrigin = `http://127.0.0.1:${server.address().port}`;
try {
  const paths = new Set([mount, ...entryUrls.map(url => new URL(url, documentUrl).pathname), ...files(root).map(path => `${mount}${relativeUrl(path)}`)]);
  for (const path of paths) {
    const response = await fetch(`${httpOrigin}${path}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, `HTTP failed: ${path}`);
    const target = localPath(path === mount ? `${mount}index.html` : path);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.equals(readFileSync(target)), `Wrong HTTP payload: ${path}`);
    if (types[extname(target)]) assert.equal(response.headers.get('content-type'), types[extname(target)], `Wrong MIME type: ${path}`);
  }
  if (mount !== '/') assert.equal((await fetch(`${httpOrigin}/assets/audio/ambient.ogg`)).status, 404);
  console.log(`Verified ${paths.size} HTTP URLs at ${mount}: entry, JS/CSS chunks, SDK, config, 14 audio files and public assets.`);
} finally {
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
}
const bytes = files(root).reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`Build verified: ${(bytes / 1024 / 1024).toFixed(2)} MiB; no direct persistence or unfinished implementation.`);
