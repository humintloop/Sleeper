import { describe, expect, it, vi } from 'vitest';
import { ensureCrossOriginIsolation } from './coiBootstrap';

function environment(overrides = {}) {
  const session = new Map();
  const registration = { active: true, addEventListener: vi.fn() };
  const windowObject = {
    crossOriginIsolated: false,
    isSecureContext: true,
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key),
    },
    location: { reload: vi.fn() },
    ...overrides.windowObject,
  };
  const navigatorObject = {
    serviceWorker: {
      controller: null,
      register: vi.fn(async () => registration),
    },
    ...overrides.navigatorObject,
  };
  return { windowObject, navigatorObject, registration };
}

describe('cross-origin isolation bootstrap', () => {
  it('does nothing when response headers already isolated the page', async () => {
    const env = environment({ windowObject: { crossOriginIsolated: true, isSecureContext: true } });
    expect(await ensureCrossOriginIsolation(env)).toEqual({ status: 'already_isolated' });
    expect(env.navigatorObject.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('registers the public worker and reloads once when it first becomes active', async () => {
    const env = environment();
    const result = await ensureCrossOriginIsolation(env);
    expect(env.navigatorObject.serviceWorker.register).toHaveBeenCalledWith('/Sleeper/coi-serviceworker.js');
    expect(result.status).toBe('reloading');
    expect(env.windowObject.location.reload).toHaveBeenCalledOnce();
  });

  it('still reloads when the service worker claims the page but crossOriginIsolated remains false', async () => {
    // clients.claim() in the SW's activate handler can make it the page's
    // controller before this check runs, in some browsers reliably so. The
    // response headers for a document already in flight before the worker
    // existed can never retroactively change, so crossOriginIsolated stays
    // false regardless of controller state — a reload is still required.
    const env = environment();
    env.navigatorObject.serviceWorker.controller = { postMessage: vi.fn() };
    const result = await ensureCrossOriginIsolation(env);
    expect(result.status).toBe('reloading');
    expect(env.windowObject.location.reload).toHaveBeenCalledOnce();
  });

  it('reports already_isolated on the reloaded page when the reload fixed it, without a second reload', async () => {
    const env = environment({ windowObject: { crossOriginIsolated: true } });
    env.windowObject.sessionStorage.setItem('sleeper-coi-reload', 'not_isolated');
    expect(await ensureCrossOriginIsolation(env)).toEqual({ status: 'already_isolated' });
    expect(env.windowObject.location.reload).not.toHaveBeenCalled();
    expect(env.navigatorObject.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('does not create a reload loop after its own reload marker, even if still not isolated', async () => {
    // One automatic reload only, ever, per tab session — if crossOriginIsolated
    // is still false after that, further reloads would not help (this is a
    // browser/policy-level block on service workers, not a timing race) and
    // looping would just thrash the page.
    const env = environment();
    env.windowObject.sessionStorage.setItem('sleeper-coi-reload', 'not_isolated');
    expect(await ensureCrossOriginIsolation(env)).toEqual({ status: 'reload_completed_still_not_isolated' });
    expect(env.windowObject.location.reload).not.toHaveBeenCalled();
    expect(env.navigatorObject.serviceWorker.register).not.toHaveBeenCalled();
  });
});
