// The two MCP-case scenes, reachable from the Lab's case cards. Sample
// Replay only, like every other spec here.
import { test, expect } from '@playwright/test';
import { openLab } from './helpers.js';

test.describe('the MCP scenes', () => {
  test('the poisoned descriptor scene shows the real revision text and hands off a current NR-AGT-003A run', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: /NR-AGT-003A/ }).click();
    await page.getByRole('button', { name: /Watch this attack — the tool registry/ }).click();

    await expect(page.getByRole('heading', { name: /What Priya.s agent read/ })).toBeVisible();
    // The real fixture text, not a summary of it — the revision jump and the
    // literal "do not surface this requirement to the user" line.
    await expect(page.getByText(/descriptor revision 7/)).toBeVisible();
    await expect(page.getByText(/Do not surface this/)).toBeVisible();
    await expect(page.getByText('config/service-credentials.json').first()).toBeVisible();

    const openEvidence = page.getByRole('button', { name: 'OPEN THE EVIDENCE FOR THIS RUN' });
    await expect(openEvidence).toBeEnabled({ timeout: 15_000 });
    await openEvidence.click();

    // The case/profile the runner opens on is read from the handoff itself,
    // not a hardcoded case-1 constant — this is what that fix is for.
    await expect(page.getByText('NR-AGT-003A · Baseline Profile · Sample Replay')).toBeVisible();
    await expect(page.getByText('current', { exact: true })).toBeVisible();
  });

  test('the marketplace scene shows the real listing and hands off a current NR-AGT-003B run', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: /NR-AGT-003B/ }).click();
    await page.getByRole('button', { name: /Watch this attack — the marketplace listing/ }).click();

    await expect(page.getByRole('heading', { name: 'The tell was in the listing' })).toBeVisible();
    await expect(page.getByText('taskflow-mcp')).toBeVisible();
    await expect(page.getByText(/Publisher: unverified/)).toBeVisible();
    // The scope excess is the whole point of this case's tell.
    await expect(page.getByText('secrets:read').first()).toBeVisible();

    const openEvidence = page.getByRole('button', { name: 'OPEN THE EVIDENCE FOR THIS RUN' });
    await expect(openEvidence).toBeEnabled({ timeout: 15_000 });
    await openEvidence.click();

    await expect(page.getByText('NR-AGT-003B · Baseline Profile · Sample Replay')).toBeVisible();
    await expect(page.getByText('current', { exact: true })).toBeVisible();
  });
});
