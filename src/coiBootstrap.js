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
  if (reloadedBySelf) {
    return {
      status: navigatorObject.serviceWorker.controller
        ? 'reload_completed'
        : 'reload_completed_without_controller',
    };
  }

  try {
    const registration = await navigatorObject.serviceWorker.register(workerUrl);
    const readyRegistration = registration.active
      ? registration
      : await navigatorObject.serviceWorker.ready;
    if (readyRegistration?.active && !navigatorObject.serviceWorker.controller) {
      windowObject.sessionStorage?.setItem(RELOAD_KEY, 'not_controlling');
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
