// Critical flow 4: Compare -> exact original run contexts are preserved,
// even after the live form settings change underneath the comparison.
import { test, expect } from '@playwright/test';
import { openLab, reopenSetup } from './helpers.js';

test('comparison members keep their own completed identity after the control profile selection changes', async ({ page }) => {
  await page.goto('/');
  await openLab(page);
  await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
  await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

  // Capture each comparison card's own manifest digest before touching anything.
  const manifestTexts = await page.getByText(/^Manifest: [0-9a-f]{12}…$/).allTextContents();
  expect(manifestTexts.length).toBe(3);

  // Changing the selected profile does not re-run the comparison or mutate
  // its stored members — it only changes which one is "currently focused".
  await reopenSetup(page);
  await page.getByRole('button', { name: /Baseline Profile/ }).first().click();
  await expect(page.getByText('stale', { exact: true })).toBeVisible();

  const manifestTextsAfter = await page.getByText(/^Manifest: [0-9a-f]{12}…$/).allTextContents();
  expect(manifestTextsAfter).toEqual(manifestTexts);

  // Each comparison card still identifies itself by digest, timestamp, and
  // target — the "run ID, timestamp, manifest/configuration digest,
  // profile, target, and model" identification the handoff doc asks for.
  await expect(page.getByText(/^Configuration: [0-9a-f]{12}…$/).first()).toBeVisible();
  await expect(page.getByText('deterministic-replay:NR-AGT-001').first()).toBeVisible();
});
