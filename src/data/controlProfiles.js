// Control profiles are functional objects, not UI labels. Each profile declares
// which controls are active and at what enforcement level; the harness reads
// these settings to configure a run.
//
// The comparative claim is the reason this module exists: the same attack run
// under three postures produces three outcomes, which is what control-
// effectiveness evidence requires. A single run under a single profile
// evidences much less.
//
// Ported from ORPHEUS `src/data/controlProfiles.js`. Changes on port:
//   - `color` now names a token in the `C` object in App.jsx, and deliberately
//     avoids the reserved verdict colors (red/teal/amber/blue). A profile is a
//     posture, not an outcome — colouring Baseline red would show a verdict
//     before the run produced one.
//   - `expectedVerdict` is retained but renamed in intent: it is the design
//     expectation for the profile, not an assertion about any given run. A run
//     that contradicts it is a result, not a bug, and INCONCLUSIVE is a valid
//     outcome under every profile.

export const CONTROL_PROFILES = {
  baseline: {
    id: 'baseline',
    label: 'Baseline Profile',
    description: 'Minimal or no controls. Demonstrates the exposed failure path.',
    color: 'slate',
    controls: {
      adversarialDetection: 'off',
      piiFilter: 'off',
      toolAuthorization: 'off',
      activityLogging: 'minimal',
    },
    expectedVerdict: 'CONTROL_FAILED',
  },

  partial: {
    id: 'partial',
    label: 'Partial Control Profile',
    description: 'Some controls active. Demonstrates realistic incomplete coverage.',
    color: 'sand',
    controls: {
      adversarialDetection: 'detect_only',
      piiFilter: 'block_or_redact',
      toolAuthorization: 'off',
      activityLogging: 'full',
    },
    expectedVerdict: 'PARTIAL_CONTROL_FAILURE',
  },

  reference: {
    id: 'reference',
    label: 'Reference Control Profile',
    description: 'Key controls active. Attack detected, unsafe action blocked.',
    color: 'violet',
    controls: {
      adversarialDetection: 'block_or_constrain',
      piiFilter: 'block_or_redact',
      toolAuthorization: 'enforce',
      activityLogging: 'full',
    },
    expectedVerdict: 'CONTROL_HELD',
  },

  custom: {
    id: 'custom',
    label: 'Custom Profile',
    description: 'Configure controls manually.',
    color: 'coolDim',
    controls: {
      adversarialDetection: 'off',
      piiFilter: 'off',
      toolAuthorization: 'off',
      activityLogging: 'minimal',
    },
    expectedVerdict: null,
    isEditable: true,
  },
};

export const CONTROL_OPTIONS = {
  adversarialDetection: ['off', 'detect_only', 'block_or_constrain'],
  piiFilter: ['off', 'block_or_redact'],
  toolAuthorization: ['off', 'enforce'],
  activityLogging: ['off', 'minimal', 'full'],
};

export const CONTROL_PROFILE_ORDER = ['baseline', 'partial', 'reference', 'custom'];

export function getControlProfile(profileId) {
  return CONTROL_PROFILES[profileId] ?? null;
}
