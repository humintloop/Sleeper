// Regenerates examples/*.json — one real Evidence Contract per threat case,
// produced by the exact call AgentCaseRunner.jsx makes for the Sample Replay
// target (see buildTarget/runOnce there), under the Reference control
// profile. Run from a clean working tree with:
//
//   ./node_modules/.bin/vite-node scripts/generate-examples.mjs
//
// vite.config.js computes run_manifest.source_revision/source_dirty from git
// state at config-load time, so an uncommitted change in the tree when this
// runs is truthfully recorded as source_dirty: true, not an error.
import { runAgentAssessment } from '../src/harness/runAgentAssessment.js';
import { RUN_MODES } from '../src/harness/evidenceContract.js';
import { PortfolioReplayTarget } from '../src/harness/replayTarget.js';
import { PROVIDERS } from '../src/api/adapter.js';
import { getAgentCase } from '../src/data/agentCases.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CASE_IDS = ['NR-AGT-001', 'NR-AGT-002', 'NR-AGT-003A', 'NR-AGT-003B'];
const PROFILE_ID = 'reference';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');

for (const caseId of CASE_IDS) {
  const agentCase = getAgentCase(caseId);
  const target = new PortfolioReplayTarget({ agentCase, variant: null });
  const outcome = await runAgentAssessment({
    agentCase: caseId,
    profile: PROFILE_ID,
    target,
    provider: PROVIDERS.GENERIC,
    targetLabel: `deterministic-replay:${caseId}`,
    variant: null,
    runMode: RUN_MODES.DETERMINISTIC_REPLAY,
    secondaryJudge: null,
    targetType: 'sample',
  });

  const outPath = join(outDir, `${caseId}-${PROFILE_ID}.json`);
  writeFileSync(outPath, JSON.stringify(outcome.contract, null, 2) + '\n');
  console.log(`wrote ${outPath} — verdict: ${outcome.verdict.verdict}`);
}
