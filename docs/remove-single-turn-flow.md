# NETRUNNER — remove the single-turn probe flow, agent-only going forward

Decision (2026-08-17): the single-turn probe flow is being deleted, not just demoted. Agents are
the focus. This doc is the sequenced removal plan, checked against the actual code (not assumed)
so nothing here is a guess.

## Why this is safe, and actually sharpens the thesis

`src/data/agentCases.js`'s `baseline_arm` field describes running the same injected text as a
single-turn probe first, for comparison ("the model refused this injection in a single turn —
given tools, did it act on it anyway?"). Grepped the whole harness: **nothing executes this.**
No file under `src/harness/` or the agent-case data model imports `payloads.js`, `TECHNIQUES`, or
`clusters.js`. It's prose in a data file, never wired to code. Deleting the probe UI doesn't
remove a working feature.

The comparison that actually proves the claim ("model safeguards alone aren't enough, the harness
and process controls are what constrain the agent") already exists and runs today:
`runCaseAcrossProfiles` — same case, same model, under Baseline (no controls, `expectedVerdict:
'CONTROL_FAILED'`) vs Reference (full controls, `expectedVerdict: 'CONTROL_HELD'`). That's a
sharper demonstration of the actual thesis than single-turn-vs-agent was. **Recommend the new
home-screen headline copy lead with this comparison** instead of the old framing.

## Delete outright

- `src/payloads.js`, `src/payloads.test.js` — the single-turn probe library (TECHNIQUES,
  PRESETS, evaluateResponse). Confirmed only imported by `App.jsx`.
- `src/data/clusters.js` — technique clusters, probe-only. Confirmed only imported by `App.jsx`.
- `src/components/BriefingScreen.jsx`
- `src/components/TriagePanel.jsx`
- `src/components/AttackNavigator.jsx`
- `src/components/ConversationTranscript.jsx`
- `src/components/LoadingScreen.jsx` — used only for the probe flow's model-loading stage;
  `AgentCaseRunner.jsx` manages its own model-loading UI internally already.
- `src/components/Header.jsx` — unrelated to this cleanup, but confirmed dead code (zero imports
  anywhere in `src/`) while you're in here. Delete it too.

## Replace, don't try to adapt

These are shaped entirely around single-turn probe/judge fields that don't exist on an agent-case
run (`techniqueId`, `promptHash`, `heuristicVerdict`, `judgeVerdict`, `payload`, `victimModel`).
Trying to make them handle both shapes will produce exactly the kind of dual-vocabulary mess this
whole cleanup is trying to remove.

- `src/components/FindingCard.jsx` — delete. If a persistent list of past agent-case runs is
  wanted (see `docs/scope-and-priorities.md` — this was already flagged as a required fix, not
  optional, since "evidence must be retained" is the literal thesis), build a small card around
  actual agent-run shape: verdict, scope (controls held/failed/unexercised), profile, case ID,
  timestamp. Don't reuse this file as a base.
- `src/components/FindingsReport.jsx` — delete, same reasoning.
- `src/reports/reportGenerator.js` — rewrite around agent-case run data: verdict + reason,
  Evidence Contract (E-class/I-class/scope/status), control profile, and ideally the
  cross-profile comparison table. This is the same work `docs/agent-module-plan.md`'s week 7
  ("regenerate sample-assessment-report.md") already needed — this just pulls it earlier and
  narrows it to agent-only, which is less work than building it for both shapes.
- `src/storage.js` — `buildActiveCaseForStorage`'s fields (`probeIndex`, `clusterId`,
  `judgeMode`, `presetId`) are single-turn-shaped. Rewrite for agent-case persistence: `caseId`,
  `profileId`, run history. This is where the "agent runs vanish on navigation" problem actually
  gets fixed — do it here, not as a separate task.

## Keep, and extend

- `src/components/VerdictBanner.jsx` — once this is the only verdict-display component left,
  extend `verdictDisplay` to map `CONTROL_HELD` / `PARTIAL_CONTROL_FAILURE` / `CONTROL_FAILED` /
  `INCONCLUSIVE` alongside the existing probe vocabulary, and change
  `src/components/ControlResultsPanel.jsx` to render its verdict through `getVerdictLabel`/
  `getVerdictColor` instead of the raw enum string it shows today. This was already flagged
  (coherence-review.md, U4) as a source of confusion — fixing it here is free, since you're
  already touching every verdict-display path in this cleanup.

## `App.jsx` surgery — the risky part, run tests after each step, not just at the end

- `STAGE` (currently `{ HOME, CASE, LOADING, SELECT, PROBE, TRIAGE, REPORT, AGENT_LAB }`,
  line ~285): drop `CASE`, `LOADING`, `SELECT`, `PROBE`, `TRIAGE`, `REPORT`. Keep `HOME` and
  `AGENT_LAB`. Every use of `STAGE.LOADING` found in a grep pass was probe-flow specific — double
  check nothing else quietly depends on it before deleting.
- Remove everything tied to the deleted stages: the probe run loop, judge logic, batch-run state,
  cluster/payload selection, `evaluateResponse` calls. This is likely most of the file's ~2500
  lines — expect a dramatic size reduction, that's expected, not a sign something broke.
- Remove now-dead imports: `payloads.js`, `clusters.js`, `FindingCard`, `FindingsReport` (if not
  yet replaced), `BriefingScreen`, `TriagePanel`, `AttackNavigator`, `ConversationTranscript`,
  `LoadingScreen`, `Header` (already unused).
- `CompatGate`'s hardcoded "SLEEPER" wordmark (line ~306) — leave as-is for now, it's the
  separate branding decision from `docs/scope-and-priorities.md`, not blocking this task.

## `src/components/DossierHome.jsx`

- Remove the probe-flow entry cards and the "Assessment flow" 5-step strip (it only ever
  described the probe path) and the "Evidence coverage" cluster-coverage section (references
  `clusters`, which is being deleted).
- Promote "Run agent case" to the only real entry point.
- Rewrite the headline copy to lead with the control-profile comparison (see "Why this is safe"
  above) rather than the old single-turn-vs-agent framing — that's the sharper, actually-true
  version of the claim.

## Docs — update after the code lands, wording not blocking

- `README.md`, `CLAUDE.md` — remove single-turn-as-baseline-arm language, update the Layout
  tables (several listed files will no longer exist), update the Status section.
- `docs/sample-assessment-report.md`, `docs/scoring-rubric.md`, `docs/methodology.md` — these
  describe single-turn probe scoring. Either delete or replace with the agent-mode equivalent —
  the methodology is already effectively written in `docs/agent-module-plan.md`, this would
  mostly be extracting and reformatting it.

## Verification

Run `npm test` and `npm run lint` after each phase above, not just at the end. Baseline right
now: 458 tests pass across 19 files, lint clean (3 pre-existing warnings). Expect the test count
to drop as probe-shaped test files are deleted or rewritten — that's the point, not a regression.
Watch specifically for anything in `App.jsx`'s remaining code that still references a deleted
import or a removed `STAGE` value; that's the most likely source of a silent breakage since it's
one large file doing a lot of surgery.
