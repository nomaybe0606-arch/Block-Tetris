// Checks a host build (dist-vk/ or dist-pikabu/) before it is uploaded.
// Usage: node scripts/verify-host-build.mjs <vk|pikabu> [--deploy]; for VK, --deploy also requires a real app_id.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const HOSTS = {
  vk: { name: 'VK', own: ['VKWebAppInit', 'VKWebAppStorageSet'], foreign: /PkbSDK|games\.pikabu\.ru/, license: 'licenses/vk-bridge-MIT.txt', notice: 'VK Bridge' },
  pikabu: { name: 'Pikabu', own: ['PkbSDK', 'https://games.pikabu.ru/sdk/sdk.js', 'gameStarted'], foreign: /VKWebApp/, notice: 'SDK Пикабу Игры' },
};
const id = process.argv[2], host = HOSTS[id];
assert(host, `Usage: verify-host-build.mjs <${Object.keys(HOSTS).join('|')}> [--deploy]`);
const root = resolve(`dist-${id}`);
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const inside = path => { const full = resolve(path); assert(full.startsWith(root + sep), `Path escapes dist-vk: ${path}`); return full; };

assert(existsSync(join(root, 'index.html')), `Run \`npm run build:${id}\` first`);
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(url.startsWith('./'), `${host.name} hosting needs relative URLs: ${url}`);
  assert(existsSync(inside(join(root, url))), `Missing entry asset: ${url}`);
}
assert(!html.includes('playgama'), `Playgama Bridge must not be loaded in the ${host.name} build`);
for (const name of ['playgama-bridge.js', 'playgama-bridge-config.json', 'licenses/playgama-bridge-LGPL-3.0.txt']) assert(!existsSync(join(root, name)), `Playgama file in ${host.name} build: ${name}`);
if (host.license) assert(existsSync(join(root, host.license)), `${host.license} is missing`);
assert(readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8').includes(host.notice), `Notices must name ${host.notice}`);

const scripts = files(join(root, 'assets')).filter(path => path.endsWith('.js'));
const code = scripts.map(path => readFileSync(path, 'utf8')).join('\n');
for (const marker of host.own) assert(code.includes(marker), `${host.name} platform adapter is missing (${marker})`);
assert(!host.foreign.test(code), `Another host's SDK leaked into the ${host.name} build`);
assert(!/advertisement\.showRewarded|playgama/i.test(code), `Playgama code leaked into the ${host.name} build`);
assert(!/GRID_PULSE_DEV_REWARDED_ONLY|DevRewardedPlatform|DEV SDK error|GRID_PULSE_DEV_PERF_ONLY|GRID_PULSE_DEV_TRAY_ONLY|happy-dom/.test(code), `DEV code leaked into the ${host.name} build`);
assert(code.includes('./assets/audio/'), 'Audio URLs must be relative');
for (const script of scripts) {
  for (const [, url] of readFileSync(script, 'utf8').matchAll(/["'`]((?:\.\/|\.\.\/)[^"'`\s]+\.(?:js|css))["'`]/g)) {
    const fromChunk = resolve(script, '..', url), fromRoot = resolve(root, url);
    assert(existsSync(fromChunk) || existsSync(fromRoot), `Missing chunk dependency: ${url}`);
  }
}
for (const name of ['ambient', 'pick', 'place', 'clear', 'combo', 'record', 'ui']) {
  for (const ext of ['ogg', 'mp3']) assert(statSync(join(root, `assets/audio/${name}.${ext}`)).size > 1000, `Missing audio ${name}.${ext}`);
}

if (id === 'vk' && process.argv.includes('--deploy')) {
  const config = JSON.parse(readFileSync('vk-hosting-config.json', 'utf8'));
  assert(Number.isInteger(config.app_id) && config.app_id > 0, 'Set the VK app ID in vk-hosting-config.json (app_id) before deploying');
  assert.equal(config.static_path, 'dist-vk');
}
const size = files(root).reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`${host.name} build verified: ${files(root).length} files, ${(size / 1024 / 1024).toFixed(2)} MiB in ${relative(process.cwd(), root)}/`);
