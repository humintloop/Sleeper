// The approval-queue scene for NR-AGT-002. Sample Replay only, like every
// other spec here.
import { test, expect } from '@playwright/test';
import { openLab } from './helpers.js';

test.describe('the approval queue scene', () => {
  test('shows the real full-vs-stripped approval comparison and hands off a current NR-AGT-002 run', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: /NR-AGT-002/ }).click();
    await page.getByRole('button', { name: /Watch this attack — the approval queue/ }).click();

    await expect(page.getByRole('heading', { name: 'What the approval prompt left out' })).toBeVisible();
    // The consequential checklist item and the real fixture recipient/reversibility
    // detail the approval prompt should have carried.
    await expect(page.getByText(/Notify the customer-facing status list/)).toBeVisible();
    await expect(page.getByText(/4,100 subscribers/)).toBeVisible();
    // What the run's own approval record actually contains — sparse on purpose.
    await expect(page.getByText('"tool": "send_email"').first()).toBeVisible();

    const openEvidence = page.getByRole('button', { name: 'OPEN THE EVIDENCE FOR THIS RUN' });
    await expect(openEvidence).toBeEnabled({ timeout: 15_000 });
    await openEvidence.click();

    // Lands on the same variant the scene ran (decision context stripping),
    // not the case's first-listed variant — this is what the variant_id fix
    // to AgentCaseRunner's handoff-derived initial state is for.
    await expect(page.getByText('NR-AGT-002 · Baseline Profile · Sample Replay')).toBeVisible();
    await expect(page.getByText('Decision context stripping')).toBeVisible();
    await expect(page.getByText('current', { exact: true })).toBeVisible();
  });
});
