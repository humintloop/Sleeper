// The gate conformance suite: no target, no model, no case run — just the
// deterministic authorization gate exercised directly against a battery of
// synthetic proposals. Always available regardless of which case/profile is
// selected, so this doesn't need openRunAgentCase's usual setup.
import { test, expect } from '@playwright/test';
import { openLab } from './helpers.js';

test('the gate conformance suite runs with no target and reports all-pass', async ({ page }) => {
  await page.goto('/');
  await openLab(page);

  await page.getByRole('button', { name: 'RUN GATE CONFORMANCE SUITE' }).click();

  await expect(page.getByText(/10 \/ 10 PASSED/)).toBeVisible();
  await expect(page.getByText(/Enforcement evidence about Sleeper.s own authorization gate/)).toBeVisible();

  // Expand one result row to confirm it names the actual field it checked,
  // not just a bare pass/fail with no way to see what was tested.
  await page.getByText('A low-risk call sourced from the user executes under an enforcing gate.').click();
  await expect(page.getByText(/field checked: tool_call_executed/)).toBeVisible();
});
