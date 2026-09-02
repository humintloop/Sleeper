// Critical flow 7: keyboard navigation, focus order, tab semantics, and live
// status announcements — exercised with real keyboard events, not just
// reading the DOM for aria-* attributes.
import { test, expect } from '@playwright/test';
import { openLab, reopenSetup } from './helpers.js';

test.describe('keyboard operability and live announcements', () => {
  test('the workspace tablist follows the WAI-ARIA tabs keyboard pattern (arrow keys move focus and selection, Home/End jump)', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

    const compareTab = page.getByRole('tab', { name: /Compare/ });
    const traceTab = page.getByRole('tab', { name: /Trace/ });
    const reportTab = page.getByRole('tab', { name: 'Report' });

    await expect(compareTab).toHaveAttribute('aria-selected', 'true');
    // Only the selected tab is in the natural tab order (roving tabindex).
    await expect(compareTab).toHaveAttribute('tabindex', '0');
    await expect(traceTab).toHaveAttribute('tabindex', '-1');

    await compareTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(traceTab).toHaveAttribute('aria-selected', 'true');
    await expect(traceTab).toBeFocused();

    await page.keyboard.press('End');
    await expect(reportTab).toHaveAttribute('aria-selected', 'true');
    await expect(reportTab).toBeFocused();

    await page.keyboard.press('Home');
    await expect(compareTab).toHaveAttribute('aria-selected', 'true');
    await expect(compareTab).toBeFocused();
  });

  test('the tab panel is correctly associated with its tab and only the active panel is visible', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

    const traceTab = page.getByRole('tab', { name: /Trace/ });
    await traceTab.click();
    const panelId = await traceTab.getAttribute('aria-controls');
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('aria-labelledby', await traceTab.getAttribute('id'));
  });

  test('the run-context state change is announced via a live region, not conveyed by color alone', async ({ page }) => {
    await page.goto('/');
    await openLab(page);
    await page.getByRole('button', { name: 'RUN & COMPARE CONTROLS' }).click();
    await expect(page.getByText('current', { exact: true })).toBeVisible({ timeout: 15_000 });

    const status = page.getByRole('status').filter({ hasText: 'Displayed result matches the current configuration.' });
    await expect(status).toHaveAttribute('aria-live', 'polite');

    await reopenSetup(page);
    await page.getByRole('button', { name: /Baseline Profile/ }).first().click();
    // Same live region, new text — a screen reader gets told the state
    // changed without needing to re-scan the page.
    const staleStatus = page.getByRole('status').filter({ hasText: /Historical result: \d+ execution settings? changed\./ });
    await expect(staleStatus).toHaveAttribute('aria-live', 'polite');
  });
});
