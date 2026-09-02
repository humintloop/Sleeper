// Critical flows 1-3 from the handoff doc's Phase 3 browser-test list:
//   1. Configure -> run -> current result.
//   2. Change every execution-relevant setting -> stale result with a
//      field-level diff.
//   3. Rerun -> new identity and current result.
// Sample Replay only: deterministic, no API key, no WebGPU dependency.
import { test, expect } from '@playwright/test';
import { reopenSetup } from './helpers.js';

async function openRunAgentCase(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Run agent case/ }).click();
  await expect(page.getByRole('heading', { name: 'Run agent case' })).toBeVisible();
}

test.describe('run lifecycle: configure, run, stale, rerun', () => {
  test('configuring and running reaches a CURRENT result and reveals the workspace tabs', async ({ page }) => {
    await openRunAgentCase(page);
    // Sample Replay is selected by default (no-key path).
    await expect(page.getByRole('button', { name: 'SAMPLE REPLAY' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Displayed result matches the current configuration.')).toBeVisible();

    await expect(page.getByRole('tab', { name: /Compare/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Trace/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Evidence' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Report' })).toBeVisible();
  });

  test('changing the control profile after a run goes STALE with a named field diff, and rerun returns to CURRENT', async ({ page }) => {
    await openRunAgentCase(page);
    await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Reference is selected by default; switch to Baseline without rerunning.
    await reopenSetup(page);
    await page.getByRole('button', { name: /Baseline Profile/ }).first().click();

    await expect(page.getByText('stale', { exact: true })).toBeVisible();
    await expect(page.getByText(/Historical result: \d+ execution settings? changed\./)).toBeVisible();
    // The diff names the actual changed field and both values, not just "something changed".
    await expect(page.getByText(/Control profile.*reference.*baseline/)).toBeVisible();
    const rerunButton = page.getByRole('button', { name: 'RERUN WITH CURRENT CONFIGURATION' });
    await expect(rerunButton).toBeVisible();

    await rerunButton.click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('stale', { exact: true })).not.toBeVisible();
  });

  test('the configuration digest changes on rerun, proving a new identity was assigned', async ({ page }) => {
    await openRunAgentCase(page);
    await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

    const digestLocator = page.getByText(/^[0-9a-f]{16}…$/).first();
    const digestText = await digestLocator.textContent();
    expect(digestText).toMatch(/^[0-9a-f]{16}…$/);

    await reopenSetup(page);
    await page.getByRole('button', { name: /Baseline Profile/ }).first().click();
    await page.getByRole('button', { name: 'RERUN WITH CURRENT CONFIGURATION' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

    const newDigestText = await page.getByText(/^[0-9a-f]{16}…$/).first().textContent();
    expect(newDigestText).not.toBe(digestText);
  });
});
