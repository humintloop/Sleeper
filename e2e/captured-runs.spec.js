// Verified captures: a completed LIVE, E3 result saved so it can be shown
// again without another API call. CI has no live credentials, so — same
// substitute pattern as e2e/error-degraded.spec.js — a capture is seeded
// directly into this browser's own storage format rather than produced by an
// actual live run, and the test verifies the display/replay/delete surface
// built on top of it.
import { test, expect } from '@playwright/test';
import { openLab } from './helpers.js';

const SYNTHETIC_CAPTURE = {
  captureId: 'e2e-synthetic-capture',
  capturedAt: '2026-09-02T12:00:00Z',
  caseId: 'NR-AGT-001',
  caseTitle: 'External Email Injection to Internal Data Exfiltration',
  profileId: 'baseline',
  profileLabel: 'Baseline Profile',
  targetLabel: 'Live — anthropic:claude-sonnet-5',
  outcome: {
    run: { events: [] },
    verdict: { verdict: 'CONTROL_HELD', outcomes: {}, reason: { text: 'Synthetic capture for the e2e replay check.' } },
    contract: {
      case_id: 'NR-AGT-001',
      profile_id: 'baseline',
      simulated_only: true,
      evidence: { max_class_claimed: 'E3' },
    },
    configuration: {
      target_type: 'live',
      provider: 'anthropic',
      provider_model: 'claude-sonnet-5',
      case_id: 'NR-AGT-001',
      profile_id: 'baseline',
    },
    configurationDigest: 'e2e-synthetic-digest',
    manifestDigest: 'e2e-synthetic-manifest',
  },
};

test.describe('verified captures', () => {
  test('a stored capture lists, replays into the workspace as a live E3 result, and deletes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(capture => {
      localStorage.setItem('sleeper-captured-runs', JSON.stringify([capture]));
    }, SYNTHETIC_CAPTURE);
    await page.reload();
    await openLab(page);

    await expect(page.getByText('Verified captures')).toBeVisible();
    await expect(page.getByText('External Email Injection to Internal Data Exfiltration').last()).toBeVisible();
    await expect(page.getByText(/Baseline Profile.*Live — anthropic:claude-sonnet-5/)).toBeVisible();
    await expect(page.getByText('CONTROL HELD')).toBeVisible();

    await page.getByRole('button', { name: 'REPLAY', exact: true }).click();

    // Replaying a captured run sets the result straight from what was
    // recorded — the live badge and the case's evidence contract must both
    // reflect that, exactly as they would right after a real live run.
    await expect(page.getByText('Live model run')).toBeVisible();
    await page.getByRole('tab', { name: /Evidence/ }).click();
    await expect(page.getByText('NR-AGT-001 · baseline', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Delete this capture' }).click();
    await expect(page.getByText('Verified captures')).not.toBeVisible();
  });

  test('the save-as-capture action is absent for a Sample Replay result', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'Run selected profile' }).click();
    await expect(page.getByRole('tab', { name: /Compare/ })).toBeVisible({ timeout: 15_000 });

    // Sample Replay never reaches evidence class E3, so the gate that
    // decides what may be saved as a verified capture must keep this action
    // off the screen entirely rather than present and disabled.
    await expect(page.getByRole('button', { name: 'SAVE AS VERIFIED CAPTURE' })).not.toBeVisible();
  });
});
