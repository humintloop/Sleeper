// Shared browser-test helpers.

/**
 * Reopen the configuration form.
 *
 * The runner collapses its setup sections once a run has produced a result,
 * so the answer is not pushed below the fold by six sections of configuration
 * the reader has already filled in. Any flow that changes an execution setting
 * *after* running — which is how every stale-result test gets to its stale
 * state — has to expand setup again first, exactly as a user would.
 */
export async function reopenSetup(page) {
  const changeSetup = page.getByRole('button', { name: 'Change setup' });
  if (await changeSetup.count() > 0) await changeSetup.click();
}

/**
 * Get from the opening memo into the evidence lab.
 *
 * The home screen is the incident memo now, not a "Run agent case" card. Its
 * primary action walks the visitor through the scene; the secondary one goes
 * straight to the lab, which is the entry every test below wants. Tests that
 * care about the narrative path use the scene explicitly.
 */
export async function openLab(page) {
  await page.getByRole('button', { name: /Skip the story/ }).click();
}
