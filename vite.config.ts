import { defineConfig, type Plugin } from 'vite';
import playgamaBridge from '@playgama/bridge/vite';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The VK build copies public/ like the others, then drops the Playgama-only files
// and ships the VK Bridge notice instead.
function vkDistribution(): Plugin {
  let outDir = 'dist-vk';
  return {
    name: 'vk-distribution',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      rmSync(join(outDir, 'playgama-bridge-config.json'), { force: true });
      rmSync(join(outDir, 'licenses/playgama-bridge-LGPL-3.0.txt'), { force: true });
      rmSync(join(outDir, 'licenses/GPL-3.0.txt'), { force: true });
      writeFileSync(join(outDir, 'licenses/vk-bridge-MIT.txt'), readFileSync('node_modules/@vkontakte/vk-bridge/LICENSE'));
      const notices = readFileSync(join(outDir, 'THIRD_PARTY_NOTICES.md'), 'utf8')
        .replace(/## Playgama Bridge[\s\S]*?(?=\n## )/, '## VK Bridge 3.0.2\n\nCopyright V Kontakte LLC. MIT license. Full license: `licenses/vk-bridge-MIT.txt`.\nSource: https://github.com/VKCOM/vk-bridge\n');
      writeFileSync(join(outDir, 'THIRD_PARTY_NOTICES.md'), notices);
    },
  };
}

export default defineConfig(({ command, mode, isPreview }) => ({
  // Pages is the default production target. Dev remains at /; preview matches the build.
  // Portable modes (platform archive, VK hosting) use relative URLs.
  base: command === 'serve' && !isPreview ? '/' : mode === 'platform' || mode === 'vk' ? './' : '/Block-Tetris/',
  plugins: [mode === 'vk' ? vkDistribution() : playgamaBridge({ mode: 'local' })],
  server: { watch: { ignored: ['**/public/licenses/**', '**/artifacts/**'] } },
  build: {
    target: 'es2022',
    outDir: mode === 'vk' ? 'dist-vk' : 'dist',
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
}));
