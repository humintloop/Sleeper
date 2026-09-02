// Browser-side registration for the static-host cross-origin-isolation worker.
// Kept separate from public/coi-serviceworker.js so Vite can bundle this module
// normally while GitHub Pages serves the worker at a stable public URL.
const RELOAD_KEY = 'sleeper-coi-reload';

export async function ensureCrossOriginIsolation({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
} = {}) {
  if (!windowObject || !navigatorObject?.serviceWorker) return { status: 'unsupported' };
  if (windowObject.crossOriginIsolated === true) return { status: 'already_isolated' };
  if (!windowObject.isSecureContext) return { status: 'insecure_context' };

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
    return { status: 'reload_completed_still_not_isolated' };
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
      return { status: 'reloading', worker_url: workerUrl };
    }
    return { status: 'registered', worker_url: workerUrl };
  } catch (error) {
    console.error('COI registration failed:', error);
    return { status: 'registration_failed', error: error?.message ?? String(error) };
  }
}

void ensureCrossOriginIsolation();
