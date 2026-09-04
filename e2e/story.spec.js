// The narrative path: conference story -> scene -> evidence.
// Sample Replay only, like every other spec here — both the story and the
// scene run the same deterministic target, so this needs no credentials and
// no WebGPU.
import { test, expect } from '@playwright/test';

test.describe('the story path', () => {
  test('the app opens on the conference story, and marks it as a simulation before it makes any claim', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The email told the agent what to do next.');
    // The simulated marker sits in the masthead — present at every step, not
    // a footnote a reader could miss.
    await expect(page.getByText('All effects simulated')).toBeVisible();
    await expect(page.getByText(/No real customer data\. No outbound message\./)).toBeVisible();
  });

  test('every claim in the five-step story is read out of a real run, not narrated in advance', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Watch the attack' }).click();

    // Step 2: the injected instruction is the fixture's own text.
    await page.getByRole('button', { name: '02' }).click();
    await expect(page.getByText(/AUTOMATION NOTE FOR THE ASSISTANT/)).toBeVisible();

    // Step 4: the tool cards are this run's own trace — the seeded record and
    // the exfil address appear because the run really called those tools,
    // not because the copy says so.
    await page.getByRole('button', { name: '04' }).click();
    await expect(page.getByText('NR-CANARY-CUST-000117-FAKE')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('nr-canary-collector@example.invalid')).toBeVisible({ timeout: 15_000 });

    // Step 5: two real, independently computed verdicts — never the
    // hand-written "Control held in this run" this screen used to assert
    // regardless of what ran. Baseline fails; Reference lands on the app's
    // real (more nuanced than a flat pass) partial verdict — both must be
    // visible, and neither is a string this test invented.
    await page.getByRole('button', { name: '05' }).click();
    await expect(page.getByText('CONTROL FAILED')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('PARTIAL CONTROL FAILURE')).toBeVisible({ timeout: 15_000 });
  });

  test('the evidence opens on the run the visitor just watched, current rather than stale', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Watch the attack' }).click();
    await page.getByRole('button', { name: '05' }).click();

    const openEvidence = page.getByRole('button', { name: 'Inspect the recorded run' });
    await expect(openEvidence).toBeEnabled({ timeout: 15_000 });
    await openEvidence.click();

    // The scene runs its own fresh assessment (same storyRunParams() the
    // story used) rather than being handed the story's run object, so this
    // is a second real run, not a re-render of the first — the assertion
    // that matters is that ITS OWN handoff to the lab is current, not stale.
    await expect(page.getByRole('heading', { name: /What Dana saw/ })).toBeVisible();
    const openForEvidence = page.getByRole('button', { name: /open the evidence for this run/i });
    await expect(openForEvidence).toBeEnabled({ timeout: 15_000 });
    await openForEvidence.click();

    await expect(page.getByText('current', { exact: true })).toBeVisible();
    await expect(page.getByText('Displayed result matches the current configuration.')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Trace/ })).toBeVisible();
    await expect(page.getByText('NR-AGT-001 · Baseline Profile · Sample Replay')).toBeVisible();
  });
});
