import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { execFileSync } from 'node:child_process';

function gitMetadata() {
  try {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
    return { revision, dirty };
  } catch (_) {
    return { revision: 'unrecorded', dirty: null };
  }
}

const git = gitMetadata();

export default defineConfig({
  plugins: [
    react(),
    // Opt-in bundle inspection: `ANALYZE=true npm run build` writes
    // dist/bundle-stats.html instead of speculatively "optimizing" without
    // evidence of what's actually large (the handoff doc's own instruction).
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'dist/bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ].filter(Boolean),
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(git.revision),
    'import.meta.env.VITE_GIT_DIRTY': JSON.stringify(git.dirty),
  },
  base: '/Sleeper/',
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
