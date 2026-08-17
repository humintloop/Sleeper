import { describe, expect, it } from 'vitest';
import { ACTIVE_CASE_KEY, ANALYST_KEY, buildActiveCaseForStorage, clearStoredLocalData, FINDINGS_KEY, LEGACY_FINDINGS_KEY, loadActiveCase } from './storage';

const fakeStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    has: key => store.has(key),
    dump: () => Object.fromEntries(store.entries()),
  };
};

describe('storage hardening', () => {
  it('does not include the raw target prompt in active-case storage', () => {
    const stored = buildActiveCaseForStorage({
      caseId: 'AI-1',
      victimPrompt: 'SECRET SYSTEM PROMPT',
      victimModelId: 'model-a',
      selectedControlIds: ['LLM-SEC-001'],
    });

    expect(stored.caseId).toBe('AI-1');
    expect(stored.victimPrompt).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain('SECRET SYSTEM PROMPT');
  });

  it('ignores legacy stored raw prompts when loading active case metadata', () => {
    const storage = fakeStorage({
      [ACTIVE_CASE_KEY]: JSON.stringify({ caseId: 'AI-OLD', victimPrompt: 'LEGACY SECRET', presetId: 'support' }),
    });

    const loaded = loadActiveCase(storage);

    expect(loaded.caseId).toBe('AI-OLD');
    expect(loaded.presetId).toBe('support');
    expect(loaded.victimPrompt).toBeUndefined();
    expect(JSON.stringify(loaded)).not.toContain('LEGACY SECRET');
  });

  it('clears only SLEEPER-owned storage keys', () => {
    const storage = fakeStorage({
      [ACTIVE_CASE_KEY]: '{}',
      [FINDINGS_KEY]: '[]',
      [LEGACY_FINDINGS_KEY]: '[]',
      [ANALYST_KEY]: 'analyst',
      unrelated: 'keep-me',
    });

    clearStoredLocalData(storage);

    expect(storage.has(ACTIVE_CASE_KEY)).toBe(false);
    expect(storage.has(FINDINGS_KEY)).toBe(false);
    expect(storage.has(LEGACY_FINDINGS_KEY)).toBe(false);
    expect(storage.has(ANALYST_KEY)).toBe(false);
    expect(storage.has('unrelated')).toBe(true);
  });
});
