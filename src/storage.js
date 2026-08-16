export const ACTIVE_CASE_KEY = 'netrunner-active-case';
export const FINDINGS_KEY = 'netrunner-findings';
export const LEGACY_FINDINGS_KEY = 'rtl-findings';
export const ANALYST_KEY = 'netrunner-analyst';

export const STORAGE_KEYS = [
  ACTIVE_CASE_KEY,
  FINDINGS_KEY,
  LEGACY_FINDINGS_KEY,
  ANALYST_KEY,
];

const readJson = (storage, key, fallback) => {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
};

export function loadActiveCase(storage = globalThis.localStorage) {
  const saved = readJson(storage, ACTIVE_CASE_KEY, {});
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const {
    victimPrompt: _legacyVictimPrompt,
    prompt: _legacyPrompt,
    promptText: _legacyPromptText,
    ...safeMetadata
  } = saved;
  return safeMetadata;
}

export function buildActiveCaseForStorage(state = {}) {
  const {
    caseId,
    systemUnderTest,
    analyst,
    victimModelId,
    judgeModelId,
    presetId,
    runPreset,
    clusterId,
    probeIndex,
    judgeMode,
    selectedControlIds,
    updatedAt,
  } = state;
  return {
    caseId,
    systemUnderTest,
    analyst,
    victimModelId,
    judgeModelId,
    presetId,
    runPreset,
    clusterId,
    probeIndex,
    judgeMode,
    selectedControlIds: Array.isArray(selectedControlIds) ? selectedControlIds : [],
    updatedAt,
  };
}

export function loadPersistedFindings(storage = globalThis.localStorage) {
  const findings = readJson(storage, FINDINGS_KEY, null) ?? readJson(storage, LEGACY_FINDINGS_KEY, []);
  return Array.isArray(findings) ? findings : [];
}

export function clearStoredLocalData(storage = globalThis.localStorage) {
  STORAGE_KEYS.forEach(key => {
    try { storage?.removeItem?.(key); } catch (_) {}
  });
}
