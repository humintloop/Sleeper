// Performance budget for the initial-load JS only — the chunk(s) actually
// referenced by <script> tags in dist/index.html. Lazy chunks (WebLLM,
// dynamically imported at runtime) are deliberately excluded: budgeting them
// would penalize correctly-deferred code, defeating the point of splitting
// it out in the first place. Run after `npm run build`.
//
// Threshold chosen from the Phase 2 baseline (commit 4a2f25d): the initial
// chunk was ~381 KB raw / ~116 KB gzip. 200 KB gzip leaves real headroom for
// legitimate feature growth while still catching an accidental import that
// pulls a heavy dependency into the initial chunk (e.g. WebLLM losing its
// dynamic-import boundary). Not an arbitrary round number — see the commit
// that introduced this script for the measured baseline it's based on.
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GZIP_BUDGET_BYTES = 200 * 1024;
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const indexPath = join(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error(`Not found: ${indexPath}. Run "npm run build" first.`);
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
const scriptSrcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(match => match[1]);
if (scriptSrcs.length === 0) {
  console.error('No <script src="..."> tags found in dist/index.html — cannot measure the initial-load chunk.');
  process.exit(1);
}

let totalGzip = 0;
for (const src of scriptSrcs) {
  const relative = src.replace(/^\/Sleeper\//, '').replace(/^\//, '');
  const filePath = join(distDir, relative);
  if (!existsSync(filePath)) {
    console.error(`Referenced in index.html but missing on disk: ${filePath}`);
    process.exit(1);
  }
  const gzipBytes = gzipSync(readFileSync(filePath)).length;
  totalGzip += gzipBytes;
  console.log(`${relative}: ${(gzipBytes / 1024).toFixed(1)} KB gzip`);
}

console.log(`Initial-load total: ${(totalGzip / 1024).toFixed(1)} KB gzip (budget: ${(GZIP_BUDGET_BYTES / 1024).toFixed(0)} KB)`);

if (totalGzip > GZIP_BUDGET_BYTES) {
  console.error(
    `\nBundle budget exceeded: ${(totalGzip / 1024).toFixed(1)} KB > ${(GZIP_BUDGET_BYTES / 1024).toFixed(0)} KB.\n`
    + 'Run "ANALYZE=true npm run build" and open dist/bundle-stats.html to see what grew before raising this budget.'
  );
  process.exit(1);
}

console.log('Within budget.');
