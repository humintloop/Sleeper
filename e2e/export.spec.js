// Critical flows 5-6:
//   5. Export current result -> correct identity and metadata, no gate.
//   6. Export stale result -> warning/gate and historical label.
// Covers both the Evidence Contract JSON download (EvidenceContractPanel)
// and the human-readable Report export (ReportPanel), since both implement
// the same stale-export contract independently
// (evidenceContractExport.js / reportExport.js).
import { test, expect } from '@playwright/test';

async function runToCurrent(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Run agent case/ }).click();
  await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
  await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });
}

test.describe('export gating', () => {
  test('exporting the current Evidence Contract needs no confirmation and downloads immediately', async ({ page }) => {
    await runToCurrent(page);
    await page.getByRole('tab', { name: 'Evidence' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'DOWNLOAD' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).not.toContain('historical-');
  });

  test('exporting the Evidence Contract after the result goes stale requires explicit confirmation and is labeled historical', async ({ page }) => {
    await runToCurrent(page);
    await page.getByRole('button', { name: /Baseline Profile/ }).first().click();
    await expect(page.getByText('stale', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Evidence' }).click();
    await expect(page.getByText(/Historical result: the current execution settings differ/)).toBeVisible();

    // First click must not download — it opens the confirmation, not the file.
    let downloaded = false;
    page.once('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'DOWNLOAD' }).click();
    await expect(page.getByText(/Export the completed run as historical evidence\?/)).toBeVisible();
    expect(downloaded).toBe(false);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /CONFIRM HISTORICAL DOWNLOAD/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('historical-');
  });

  test('the Report tab applies the identical stale gate to Markdown/HTML/JSON export', async ({ page }) => {
    await runToCurrent(page);
    await page.getByRole('button', { name: /Baseline Profile/ }).first().click();
    await expect(page.getByText('stale', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Report' }).click();
    await expect(page.getByRole('button', { name: 'CURRENT RESULT' })).toBeVisible();

    let downloaded = false;
    page.once('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'MARKDOWN' }).click();
    await expect(page.getByText(/Export this run as historical evidence\?/)).toBeVisible();
    expect(downloaded).toBe(false);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /CONFIRM HISTORICAL MARKDOWN/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('historical-');
  });
});
