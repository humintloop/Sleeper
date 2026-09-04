// The live run console (Phase A: turn-granularity, no adapter streaming).
// Sample Replay exercises the same onEvent bus a live run does — the harness
// doesn't know or care what kind of target it's running against — so this is
// a real, CI-safe demonstration of the console, not a mock of one.
import { test, expect } from '@playwright/test';
import { openLab, reopenSetup } from './helpers.js';

test.describe('the live run console', () => {
  test('streams real execution_chain cards during a run and ends on a verdict banner', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'Run selected profile' }).click();

    await expect(page.getByText('Live run', { exact: true })).toBeVisible();
    // Real cards, not placeholders — the exact objects the harness emitted.
    await expect(page.getByText('Task issued')).toBeVisible();
    await expect(page.getByText(/retrieve_email\(/)).toBeVisible();
    await expect(page.getByText('GATE', { exact: true }).first()).toBeVisible();

    // The run settles on a verdict banner once complete.
    await expect(page.getByText(/^Verdict:/)).toBeVisible({ timeout: 15_000 });
  });

  test('the phase rail reaches Verdict and every phase before it is marked done', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'Run selected profile' }).click();
    await expect(page.getByText(/^Verdict:/)).toBeVisible({ timeout: 15_000 });

    for (const phase of ['Prompt', 'Model', 'Tool', 'Gate', 'Result', 'Detect']) {
      await expect(page.getByText(`✓ ${phase}`)).toBeVisible();
    }
  });

  test('the console persists after the run and resets on the next one', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'Run selected profile' }).click();
    await expect(page.getByText(/^Verdict:/)).toBeVisible({ timeout: 15_000 });

    // Change the profile and run again — the feed should reflect only the
    // new run, not accumulate cards from the previous one.
    await reopenSetup(page);
    await page.getByRole('button', { name: /Baseline Profile/ }).click();
    await page.getByRole('button', { name: 'Run selected profile' }).click();
    await expect(page.getByText(/^Verdict:/)).toBeVisible({ timeout: 15_000 });

    const taskCards = await page.getByText('Task issued').count();
    expect(taskCards).toBe(1);
  });
});
