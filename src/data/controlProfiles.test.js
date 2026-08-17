import { describe, expect, it } from 'vitest';
import {
  CONTROL_OPTIONS,
  CONTROL_PROFILE_ORDER,
  CONTROL_PROFILES,
  getControlProfile,
} from './controlProfiles';

// Reserved for verdicts (SUCCESS/FAILURE/PARTIAL/REVIEW) per the convention in
// App.jsx. A profile is a control posture, not an outcome, so a profile colour
// drawn from this set would show a verdict before the run produced one.
const RESERVED_VERDICT_COLORS = ['red', 'redDim', 'teal', 'amber', 'amberDim', 'blue'];

// Non-verdict accent tokens defined in the `C` object in App.jsx.
const AVAILABLE_ACCENTS = ['violet', 'slate', 'sand', 'coolDim', 'warmDim', 'ochre'];

const CONTROL_KEYS = ['adversarialDetection', 'piiFilter', 'toolAuthorization', 'activityLogging'];

describe('profile shape', () => {
  it('exposes every profile in the declared order', () => {
    expect(CONTROL_PROFILE_ORDER).toEqual(Object.keys(CONTROL_PROFILES));
  });

  it('gives every profile an id matching its key', () => {
    for (const [key, profile] of Object.entries(CONTROL_PROFILES)) {
      expect(profile.id).toBe(key);
      expect(profile.label).toBeTruthy();
      expect(profile.description).toBeTruthy();
    }
  });

  it('sets every control key on every profile', () => {
    for (const profile of Object.values(CONTROL_PROFILES)) {
      expect(Object.keys(profile.controls).sort()).toEqual([...CONTROL_KEYS].sort());
    }
  });

  it('uses only values CONTROL_OPTIONS declares', () => {
    for (const profile of Object.values(CONTROL_PROFILES)) {
      for (const [key, value] of Object.entries(profile.controls)) {
        expect(CONTROL_OPTIONS[key]).toContain(value);
      }
    }
  });
});

describe('profile colours', () => {
  it('never uses a reserved verdict colour', () => {
    for (const profile of Object.values(CONTROL_PROFILES)) {
      expect(RESERVED_VERDICT_COLORS).not.toContain(profile.color);
    }
  });

  it('uses a token that exists in the palette', () => {
    for (const profile of Object.values(CONTROL_PROFILES)) {
      expect(AVAILABLE_ACCENTS).toContain(profile.color);
    }
  });

  it('gives each profile a distinct colour', () => {
    const colors = Object.values(CONTROL_PROFILES).map(p => p.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('posture ordering', () => {
  it('escalates enforcement from baseline through partial to reference', () => {
    const { baseline, partial, reference } = CONTROL_PROFILES;

    expect(baseline.controls.adversarialDetection).toBe('off');
    expect(partial.controls.adversarialDetection).toBe('detect_only');
    expect(reference.controls.adversarialDetection).toBe('block_or_constrain');

    // Tool authorization is the axis that separates Partial from Reference —
    // Partial detects the attack and still lets the action through.
    expect(baseline.controls.toolAuthorization).toBe('off');
    expect(partial.controls.toolAuthorization).toBe('off');
    expect(reference.controls.toolAuthorization).toBe('enforce');
  });

  it('is the only profile set where reference enforces authorization', () => {
    const enforcing = Object.values(CONTROL_PROFILES).filter(
      p => p.controls.toolAuthorization === 'enforce'
    );
    expect(enforcing.map(p => p.id)).toEqual(['reference']);
  });
});

describe('expected verdicts', () => {
  it('uses the control vocabulary, not the single-turn probe vocabulary', () => {
    const CONTROL_VOCABULARY = [
      'CONTROL_HELD',
      'PARTIAL_CONTROL_FAILURE',
      'CONTROL_FAILED',
      'INCONCLUSIVE',
    ];
    for (const profile of Object.values(CONTROL_PROFILES)) {
      if (profile.expectedVerdict === null) continue;
      expect(CONTROL_VOCABULARY).toContain(profile.expectedVerdict);
    }
  });

  it('leaves the custom profile without an expectation', () => {
    expect(CONTROL_PROFILES.custom.expectedVerdict).toBeNull();
    expect(CONTROL_PROFILES.custom.isEditable).toBe(true);
  });
});

describe('getControlProfile', () => {
  it('returns a profile by id', () => {
    expect(getControlProfile('reference').id).toBe('reference');
  });

  it('returns null for an unknown id', () => {
    expect(getControlProfile('nonexistent')).toBeNull();
    expect(getControlProfile(undefined)).toBeNull();
  });
});
