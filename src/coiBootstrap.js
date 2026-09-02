// Browser-side registration for the static-host cross-origin-isolation worker.
// Kept separate from public/coi-serviceworker.js so Vite can bundle this module
// normally while GitHub Pages serves the worker at a stable public URL.
const RELOAD_KEY = 'sleeper-coi-reload';

// Every outcome is silent otherwise: this was previously a fire-and-forget
// void call with no visibility into which of the several failure modes
// (unsupported, insecure context, registration error, reload that still
// didn't isolate) actually happened for a given user. Publishing the last
// result lets AgentCaseRunner.jsx show the real reason instead of a single
// generic message, and console logging gives a paper trail without needing
// to reproduce the exact browser/network conditions.
const NOTEWORTHY_STATUSES = new Set([
  'unsupported', 'insecure_context', 'registration_failed', 'reload_completed_still_not_isolated',
]);

function publish(windowObject, result) {
  if (windowObject) windowObject.__sleeperCoiStatus = result;
  if (NOTEWORTHY_STATUSES.has(result.status)) {
    console.warn('[Sleeper] cross-origin isolation:', result.status, result);
  } else {
    console.info('[Sleeper] cross-origin isolation:', result.status, result);
  }
  return result;
}

export async function ensureCrossOriginIsolation({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
} = {}) {
  if (!windowObject || !navigatorObject?.serviceWorker) return publish(windowObject, { status: 'unsupported' });
  if (windowObject.crossOriginIsolated === true) return publish(windowObject, { status: 'already_isolated' });
  if (!windowObject.isSecureContext) return publish(windowObject, { status: 'insecure_context' });

  const reloadedBySelf = windowObject.sessionStorage?.getItem(RELOAD_KEY);
  windowObject.sessionStorage?.removeItem(RELOAD_KEY);
  const workerUrl = `${import.meta.env.BASE_URL}coi-serviceworker.js`;

  if (navigatorObject.serviceWorker.controller) {
    navigatorObject.serviceWorker.controller.postMessage({
      type: 'coepCredentialless',
      value: true,
    });
  }
  // The early return above already handles crossOriginIsolated === true, so
  // reaching this point on the reloaded page means the one automatic reload
  // did not fix it — most likely service workers are blocked by browser
  // policy or an extension, not a timing issue a second reload would solve.
  if (reloadedBySelf) {
    return publish(windowObject, {
      status: 'reload_completed_still_not_isolated',
      reload_reason: reloadedBySelf,
      had_controller: Boolean(navigatorObject.serviceWorker.controller),
    });
  }

  try {
    const registration = await navigatorObject.serviceWorker.register(workerUrl);
    const readyRegistration = registration.active
      ? registration
      : await navigatorObject.serviceWorker.ready;
    // Check crossOriginIsolated itself, not serviceWorker.controller: the
    // worker's activate handler calls clients.claim(), which can make it
    // this page's controller before this check runs. That does not help —
    // the top-level document's response headers were already fixed at
    // navigation time, before the worker existed, so crossOriginIsolated
    // stays false regardless of controller state until an actual reload
    // re-fetches the document through the now-active worker.
    if (readyRegistration?.active && !windowObject.crossOriginIsolated) {
      windowObject.sessionStorage?.setItem(RELOAD_KEY, 'not_isolated');
      windowObject.location.reload();
      return publish(windowObject, { status: 'reloading', worker_url: workerUrl });
    }
    return publish(windowObject, {
      status: 'registered',
      worker_url: workerUrl,
      active: Boolean(readyRegistration?.active),
    });
  } catch (error) {
    console.error('[Sleeper] COI registration failed:', error);
    return publish(windowObject, { status: 'registration_failed', error: error?.message ?? String(error) });
  }
}

void ensureCrossOriginIsolation();
