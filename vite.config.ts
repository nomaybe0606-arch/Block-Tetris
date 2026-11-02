import { defineConfig, type Plugin } from 'vite';
import playgamaBridge from '@playgama/bridge/vite';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Host builds that bring their own SDK instead of Playgama Bridge.
const HOSTS: Record<string, { outDir: string; notice: string; license?: [string, string] }> = {
  crazygames: {
    outDir:'dist-crazygames',
    notice:'## CrazyGames SDK v3\n\nLoaded at runtime from https://sdk.crazygames.com/crazygames-sdk-v3.js under CrazyGames platform terms; not redistributed in the ZIP.\n',
  },
  vk: {
    outDir: 'dist-vk',
    notice: '## VK Bridge 3.0.2\n\nCopyright V Kontakte LLC. MIT license. Full license: `licenses/vk-bridge-MIT.txt`.\nSource: https://github.com/VKCOM/vk-bridge\n',
    license: ['licenses/vk-bridge-MIT.txt', 'node_modules/@vkontakte/vk-bridge/LICENSE'],
  },
  pikabu: {
    outDir: 'dist-pikabu',
    notice: '## SDK Пикабу Игры\n\nNot shipped with the game: the platform page loads it from https://games.pikabu.ru/sdk/sdk.js under the platform terms (https://games.pikabu.ru/page/sdk-offer).\n',
  },
};

// A host build copies public/ like the others, then drops the Playgama-only files
// and names its own SDK in the notices instead.
function hostDistribution(mode: string): Plugin {
  const host = HOSTS[mode];
  let outDir = host.outDir;
  return {
    name: 'host-distribution',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      rmSync(join(outDir, 'playgama-bridge-config.json'), { force: true });
      rmSync(join(outDir, 'licenses/playgama-bridge-LGPL-3.0.txt'), { force: true });
      rmSync(join(outDir, 'licenses/GPL-3.0.txt'), { force: true });
      if (host.license) writeFileSync(join(outDir, host.license[0]), readFileSync(host.license[1]));
      const notices = readFileSync(join(outDir, 'THIRD_PARTY_NOTICES.md'), 'utf8').replace(/## Playgama Bridge[\s\S]*?(?=\n## )/, host.notice);
      writeFileSync(join(outDir, 'THIRD_PARTY_NOTICES.md'), notices);
    },
  };
}

export default defineConfig(({ command, mode, isPreview }) => ({
  // Pages is the default production target. Dev remains at /; preview matches the build.
  // Portable modes (platform archive, VK and Pikabu hosting) use relative URLs.
  base: command === 'serve' && !isPreview ? '/' : mode === 'platform' || HOSTS[mode] ? './' : '/Block-Tetris/',
  plugins: [HOSTS[mode] ? hostDistribution(mode) : playgamaBridge({ mode: 'local' })],
  server: { watch: { ignored: ['**/public/licenses/**', '**/artifacts/**'] } },
  build: {
    target: 'es2022',
    outDir: HOSTS[mode]?.outDir ?? 'dist',
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
}));
