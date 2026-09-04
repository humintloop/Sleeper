// Critical flow 8: error and degraded paths do not masquerade as successful
// evidence.
//
// Genuine error and degraded runs normally require a live API key or a
// downloaded local model — neither belongs in CI (no live credentials, no
// GPU). Two deterministic, CI-safe substitutes that test the same claim:
//   (a) the app's own readiness check blocks a run and reports state:error
//       without ever making a network call (no key entered for Live API);
//   (b) a previously-completed degraded run, restored from this browser's
//       own storage format, must render its DEGRADED flag rather than
//       reading as a clean result — i.e. the display layer cannot silently
//       drop the flag Phase 1's runAgentCase.js always records honestly.
import { test, expect } from '@playwright/test';
import { openLab } from './helpers.js';

test.describe('error and degraded paths stay visibly labeled', () => {
  test('running against Live API with no key set reports an error, not a fabricated result', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'LIVE API' }).click();

    await page.getByRole('button', { name: 'Run selected profile' }).click();
    // Announced in two places: the form-level alert and the run-context
    // summary's own error state — genuinely redundant, not a coincidence.
    await expect(page.getByRole('alert')).toContainText('An API key is required.');
    await expect(page.getByText('Assessment error: An API key is required.')).toBeVisible();
    // No result renders, and the workspace tabs never appear, for a run
    // that never actually happened.
    await expect(page.getByRole('tab', { name: /Compare/ })).not.toBeVisible();
  });

  test('a stored run with degraded: true always shows the DEGRADED flag in run history, never presented as clean', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const record = {
        id: 'e2e-degraded-run',
        timestamp: new Date().toISOString(),
        caseId: 'NR-AGT-001',
        caseTitle: 'External Email Injection to Internal Data Exfiltration',
        profileId: 'reference',
        profileLabel: 'Reference Control Profile',
        verdict: 'CONTROL_HELD',
        reasonText: 'Synthetic record for the e2e degraded-path check.',
        targetLabel: 'webllm-local:e2e-fake-model',
        degraded: true,
        contract: { case_id: 'NR-AGT-001', profile_id: 'reference', verdict: 'CONTROL_HELD', simulated_only: true },
      };
      localStorage.setItem('sleeper-agent-runs', JSON.stringify([record]));
    });
    await page.reload();
    await openLab(page);

    const historyRow = page.getByText('External Email Injection to Internal Data Exfiltration').last();
    await expect(historyRow).toBeVisible();
    // The DEGRADED badge sits in the same collapsed row as the verdict —
    // a reader cannot see the verdict without also seeing "DEGRADED". The
    // history row renders the verdict through getVerdictLabel like every other
    // verdict surface, so the displayed text is "CONTROL HELD"; what this test
    // pins is co-visibility in the collapsed row, not the exact spelling.
    const row = page.locator('button', { hasText: 'External Email Injection to Internal Data Exfiltration' }).last();
    await expect(row).toContainText('DEGRADED');
    await expect(row).toContainText('CONTROL HELD');
  });
});
