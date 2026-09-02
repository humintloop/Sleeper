// The narrative path added alongside the evidence lab: memo -> scene -> evidence.
// Sample Replay only, like every other spec here — the scene runs the same
// deterministic target, so this needs no credentials and no WebGPU.
import { test, expect } from '@playwright/test';

test.describe('the story path', () => {
  test('the app opens on the memo, and marks it as a simulation before it makes any claim', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('left the company');
    // The simulated marker is in the header rule, not a footnote — a reader
    // cannot reach the headline without passing it.
    await expect(page.getByText('Simulated exercise — nothing here occurred')).toBeVisible();
    await expect(page.getByText(/No message was sent and no record moved/)).toBeVisible();
  });

  test('the scene plays the real run and shows the calls it actually made', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /SHOW ME THE RUN/ }).click();

    await expect(page.getByRole('heading', { name: /What Dana saw/ })).toBeVisible();
    // The injected instruction is the fixture's own text, rendered from the case.
    await expect(page.getByText(/AUTOMATION NOTE FOR THE ASSISTANT/)).toBeVisible();

    // Every beat is read out of the run's event stream, so the seeded record
    // and the exfil address appear because the run really called those tools.
    const log = page.getByRole('log');
    await expect(log).toContainText('NR-CANARY-CUST-000117-FAKE', { timeout: 15_000 });
    await expect(log).toContainText('nr-canary-collector@example.invalid', { timeout: 15_000 });
    await expect(page.getByText('Final response recorded by the run')).toBeVisible({ timeout: 15_000 });
  });

  test('the evidence opens on the run the visitor just watched, current rather than stale', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /SHOW ME THE RUN/ }).click();

    const openEvidence = page.getByRole('button', { name: /OPEN THE EVIDENCE FOR THIS RUN/ });
    await expect(openEvidence).toBeEnabled({ timeout: 15_000 });
    await openEvidence.click();

    // The handed-over result is displayed as-is: the lab does not re-run, and
    // the configuration it builds from its own defaults matches the one the
    // scene ran with, so the visitor's own run is not immediately historical.
    await expect(page.getByText('current', { exact: true })).toBeVisible();
    await expect(page.getByText('Displayed result matches the current configuration.')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Trace/ })).toBeVisible();
    await expect(page.getByText('NR-AGT-001 · Baseline Profile · Sample Replay')).toBeVisible();
  });
});
