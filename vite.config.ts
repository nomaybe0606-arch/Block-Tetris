import { defineConfig } from 'vite';
import playgamaBridge from '@playgama/bridge/vite';

export default defineConfig(({ command, mode, isPreview }) => ({
  // Pages is the default production target. Dev remains at /; preview matches the build.
  // Portable mode is only an export for platform sandbox QA, not another host.
  base: command === 'serve' && !isPreview ? '/' : mode === 'platform' ? './' : '/Block-Puzzle/',
  plugins: [playgamaBridge({ mode: 'local' })],
  server: { watch: { ignored: ['**/public/licenses/**', '**/artifacts/**'] } },
  build: { target: 'es2022', rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
}));
