// Checks dist-vk/ before it is uploaded to VK hosting. `--deploy` also requires a real app_id.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve('dist-vk');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const inside = path => { const full = resolve(path); assert(full.startsWith(root + sep), `Path escapes dist-vk: ${path}`); return full; };

assert(existsSync(join(root, 'index.html')), 'Run `npm run build:vk` first');
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(url.startsWith('./'), `VK hosting needs relative URLs: ${url}`);
  assert(existsSync(inside(join(root, url))), `Missing entry asset: ${url}`);
}
assert(!html.includes('playgama'), 'Playgama Bridge must not be loaded in the VK build');
for (const name of ['playgama-bridge.js', 'playgama-bridge-config.json', 'licenses/playgama-bridge-LGPL-3.0.txt']) assert(!existsSync(join(root, name)), `Playgama file in VK build: ${name}`);
assert(existsSync(join(root, 'licenses/vk-bridge-MIT.txt')), 'VK Bridge license is missing');
assert(readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8').includes('VK Bridge'), 'Notices must name VK Bridge');

const scripts = files(join(root, 'assets')).filter(path => path.endsWith('.js'));
const code = scripts.map(path => readFileSync(path, 'utf8')).join('\n');
assert(code.includes('VKWebAppInit') && code.includes('VKWebAppStorageSet'), 'VK platform adapter is missing');
assert(!/advertisement\.showRewarded|playgama/i.test(code), 'Playgama code leaked into the VK build');
assert(!/GRID_PULSE_DEV_REWARDED_ONLY|DevRewardedPlatform|DEV SDK error|GRID_PULSE_DEV_PERF_ONLY|GRID_PULSE_DEV_TRAY_ONLY|happy-dom/.test(code), 'DEV code leaked into the VK build');
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

if (process.argv.includes('--deploy')) {
  const config = JSON.parse(readFileSync('vk-hosting-config.json', 'utf8'));
  assert(Number.isInteger(config.app_id) && config.app_id > 0, 'Set the VK app ID in vk-hosting-config.json (app_id) before deploying');
  assert.equal(config.static_path, 'dist-vk');
}
const size = files(root).reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`VK build verified: ${files(root).length} files, ${(size / 1024 / 1024).toFixed(2)} MiB in ${relative(process.cwd(), root)}/`);
