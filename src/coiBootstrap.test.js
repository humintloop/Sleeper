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

  it('does not create a reload loop after its own reload marker', async () => {
    const env = environment();
    env.windowObject.sessionStorage.setItem('sleeper-coi-reload', 'not_controlling');
    expect(await ensureCrossOriginIsolation(env)).toEqual({ status: 'reload_completed_without_controller' });
    expect(env.windowObject.location.reload).not.toHaveBeenCalled();
    expect(env.navigatorObject.serviceWorker.register).not.toHaveBeenCalled();
  });
});
