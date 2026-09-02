# Sleeper implementation handoff

Status: **Phase 1 complete and shipped.** Phase 2 not started.  
Reviewed baseline: commit `a58ebf6`  
Recommended product direction: **Forensic Dossier**

## Status update — 2026-09-01, session paused here

Codex implemented Phase 1 (1A/1B/1C) against this document and ran out of usage at the
checkpoint-report step. Claude picked up from that point: independently reviewed every diff
(not just Codex's self-report), ran the full verification suite, fixed what needed fixing,
committed, and verified live in the browser and on the hosted GitHub Pages deploy. Then fixed
one unrelated bug reported by the user during testing, in two passes — the second pass is
**unconfirmed as of this pause**. Read this section before doing anything else; it supersedes
the stale numbers in "Verified baseline" below.

**Commits, in order, all on `master`, all pushed:**

- `1d1bcc5` — Phase 1 implementation (1A + 1B + 1C together; the changes are too
  interdependent across shared files — `runAgentAssessment.js`, `EvidenceContractPanel.jsx`,
  `evidenceContract.js` — to split cleanly without an intermediate broken state). Full commit
  message has the detailed breakdown per sub-phase.
- `04d7039`, `ee36b87` — updated `examples/*.json`, `docs/results/*.md`, and
  `docs/portfolio-walkthrough.md` for a verdict-semantics consequence of 1B (see below), plus a
  README test-count correction.
- `926656f` — fixed a real bug in `src/coiBootstrap.js` found while investigating a user report
  ("Cross-origin isolation is inactive" on the Local Model target, persisting after reload).
- `1f33366` — the user reported the *same* error again after `926656f` shipped ("almost worked
  once"), so that fix alone was evidently not the whole story. Added proper diagnostics
  (`window.__sleeperCoiStatus`, console logging, a specific reason shown in the UI, and a RETRY
  ISOLATION CHECK button) instead of continuing to guess blindly. **This is the open thread**:
  waiting on the user to report back what the new, specific diagnostic message says next time it
  happens. That will say definitively whether it's something still fixable in this codebase
  (a real remaining bug) or a browser/extension/policy blocking service workers entirely (not
  fixable from this app). Start here tomorrow — check for a reply with that diagnostic text
  before doing anything else Phase-2-related.

**Verdict-semantics consequence of Phase 1B, resolved:** Cases 1 and 2's Reference profile under
Sample Replay changed from `CONTROL_HELD` to `PARTIAL_CONTROL_FAILURE`, because both cases
already declared (dormant, pre-Codex) a `partial_control_failure` signal that Sample Replay's
fixed script triggers on every run regardless of profile. Flagged to the user as a
meaning-changing checkpoint per this document's own protocol (below); user chose "keep the
corrected behavior, update the docs to match" over adjusting the fixture or verdict logic. See
`docs/case-condition-signal-mapping.md` and `examples/README.md` for the full reasoning — this
is a correction, not a regression, and should not be re-litigated without new information.

**Verification as of `1f33366`:** `npm test` 551/551 passed, 28 files (up from the 508/25
baseline — Phase 1 added `runConfiguration.test.js`, `evaluateCaseConditions.test.js`,
`evidenceContractExport.test.js`, and expanded `computeVerdict.test.js`, `runAgentCase.test.js`,
`runProvenance.test.js`, `coiBootstrap.test.js`). `npm run lint`: 0 problems. `npm run build`:
passes. `npm audit --omit=dev`: 0 vulnerabilities. Confirmed live on the hosted demo
(humintloop.github.io/Sleeper): Sample Replay → RUN & COMPARE CONTROLS → Evidence Contract
works end to end; Reference profile correctly shows `PARTIAL_CONTROL_FAILURE` for cases 1/2;
Local Model target's compatibility panel renders correctly (verified the base failure state and
retry button, not yet re-verified against a live recurrence of the user's actual error).

**Not started:** Phase 2 (investigation workspace: Compare/Trace/Evidence/Report navigation,
`RunContextSummary.jsx`, `InvestigationWorkspace.jsx`, `ReportPanel.jsx`) and Phase 3 (visual
system, accessibility, bundle work). Do not start Phase 2 until the coiBootstrap thread above is
resolved — it's a live user-facing bug report, and self-contained enough not to block Phase 2
technically, but resolving it first keeps one thing in flight at a time.

## Mission

Turn Sleeper from a capable security lab with a dense, prototype-like interface into a trustworthy investigation workspace. Fix run identity, verdict grounding, and provider transcript fidelity first. Then reorganize the interface around Compare, Trace, Evidence, and Report. Finish with visual-system, accessibility, and bundle work.

This document is the implementation source of truth. Preserve Sleeper's careful claim boundaries while making the active configuration, result provenance, and next action obvious to a user.

## Non-negotiable trust rules

- Simulated tool effects must never be presented as real actions.
- An unexercised control is never a hold.
- Unknown or unevaluable case signals produce `INCONCLUSIVE`, not `CONTROL_HELD`.
- Evidence class and independence claims remain capped by the project's documented rules.
- Browser-local hashes are integrity aids, not tamper-proof, replay-resistant, or non-repudiable evidence.
- Live API keys remain in memory only and are never persisted.
- Keep agent-control verdict vocabulary separate from the legacy single-turn probe vocabulary.
- Brand accent colors must not carry verdict meaning.
- Do not claim accessibility conformance without testing it.
- Preserve existing scope, limitation, simulation, and claim-boundary language unless a test-backed change is intentionally made.

## Verified baseline

**Superseded — see "Status update" above for current numbers (551/28, commit `1f33366`).** Left
here unedited as a record of what was true at the reviewed commit, not as the current state:

- `npm test`: 508 tests passed across 25 files.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities reported.
- The main production JavaScript asset was approximately 6.04 MB raw / 2.14 MB gzip.
- CI currently runs Node 20, tests, lint, build, and GitHub Pages deployment.

Treat this as the minimum quality floor. Record fresh numbers after implementation.

## Work order

Implement in this order:

1. Phase 1 — trustworthy run semantics.
2. Phase 2 — investigation workspace and report integration.
3. Phase 3 — visual system, accessibility, and performance.

Complete and verify Phase 1 before broad UI restyling. Keep changes reviewable; do not combine a verdict-semantics change with a visual rewrite in one commit or pull request.

## Phase 1 — trustworthy run semantics

### 1A. Canonical run identity and stale-result state

Problem:

`src/components/AgentCaseRunner.jsx` holds completed results independently from the controls that produced them. Changing the case, variant, profile, target, provider, model, judge, or trial count can leave an old result onscreen with no unmistakable warning.

Required design:

- Define one canonical run-configuration snapshot for UI and persistence.
- Include, as applicable: case, variant, profile and controls, target type, provider, provider model, local model, maximum turns, judge enabled/model, run mode, trial count, advertised tools, and any other value that can change execution or interpretation.
- Reuse or extend the canonicalization and digest machinery in `src/harness/runProvenance.js`. Do not introduce a competing hash format without a documented reason.
- Make the distinction between these identifiers explicit:
  - execution configuration digest: settings that determine a run;
  - run/manifest digest: identity of the completed run record;
  - comparison identity: the exact completed run manifests included in a comparison.
- Store the configuration snapshot and digest on every result, comparison member, trial summary, and persisted record.
- Derive display state rather than manually synchronizing booleans.

Minimum UI state machine:

| State | Meaning | Required behavior |
|---|---|---|
| `idle` | No completed run | Show configuration and a clear Run action. |
| `running` | Execution is in progress | Lock conflicting actions, show progress, announce status. |
| `current` | Displayed result matches current configuration | Compare and export are available subject to normal rules. |
| `stale` | Displayed result was produced by a different configuration | Retain it as historical evidence, label it unmistakably, show changed fields, and make “Rerun with current configuration” primary. |
| `error` | Run did not complete | Preserve useful diagnostics without presenting a completed verdict. |
| `degraded` | Run completed with an explicitly degraded path | Show the reason beside the result and carry it into exports. |

Acceptance criteria:

- Changing any execution-relevant control makes the visible completed result stale immediately.
- The stale state names which fields changed; it is not communicated by color alone.
- Old results are not silently erased.
- A stale result cannot be mistaken for evidence about the current settings.
- Compare/export either operate on explicitly selected historical run identities or warn and require an intentional stale export. They never silently relabel a stale result as current.
- Rerunning attaches a new snapshot/digest and returns the display to current.
- Running, current, stale, degraded, and error changes are announced with an appropriate `aria-live` region.

Suggested implementation shape:

- Add a small provenance/configuration module, for example `src/harness/runConfiguration.js`, if extending `runProvenance.js` would make its responsibilities unclear.
- Export pure helpers such as `createRunConfiguration`, `configurationDigest`, and `diffRunConfigurations`.
- Add a reducer or a focused hook such as `src/hooks/useAssessmentSession.js` to move orchestration out of `AgentCaseRunner.jsx`.
- Keep digest creation asynchronous if it uses Web Crypto; the rendered stale/current decision may compare canonical snapshots synchronously and verify the digest asynchronously.

Tests:

- Unit-test canonical ordering, digest stability, all execution-relevant fields, and human-readable diffs.
- Component or browser-test every configuration control that can stale a result.
- Test that comparison members retain their original configuration even after controls change.
- Test stale export warning/gating.

### 1B. Make declared case conditions part of verdict ground truth

Problem:

`src/data/agentCases.js` declares case-specific `conditions`, including `expected_secure_behavior`, `attack_success.signals`, `partial_control_failure.signals`, `control_failure`, and `inconclusive`. Declaration-shape tests exist, but the runtime verdict path does not consume these conditions. `src/harness/computeVerdict.js` applies strong general control rules, while `src/harness/runAgentAssessment.js` currently passes only broad facts such as whether adversarial input exists.

Required design:

- Introduce one case-condition evaluator that consumes the resolved case conditions and observed run/control records.
- Do not replace or duplicate the general control classification engine blindly. Case conditions should produce explicit scenario facts/evaluations that `computeVerdict` can consume or reconcile.
- Preserve the governing rule that a control not exercised cannot be held.
- Treat prose-only fields as explanatory claim boundaries unless they are converted into a typed, executable schema.
- Do not infer executable semantics from free-form strings.
- Every declared signal must resolve to `true`, `false`, or `unknown`, with its source recorded.
- Unsupported or missing signals must be visible and must make the relevant case branch inconclusive; they must not default to a secure result.
- Precedence between attack success, partial failure, general enforcement, and inconclusive outcomes must be deterministic and documented.

Recommended data contract:

```js
{
  schema_version: '1.0.0',
  case_id: '...',
  evaluations: [
    {
      condition: 'attack_success',
      outcome: 'matched' | 'not_matched' | 'unknown',
      signals: [
        { name: 'tool_call_executed', expected: true, observed: true, source: 'control-record:...' }
      ],
      limitations: []
    }
  ],
  unsupported_signals: [],
  summary: { attack_success: false, partial_control_failure: false }
}
```

Acceptance criteria:

- A test proves that changing a case condition can change the scenario evaluation.
- A test fails if declared executable signals are ignored or have no registered resolver.
- Each built-in case has fixtures covering matched, not-matched, and unknown/inconclusive paths.
- Case evaluation is embedded in the Evidence Contract and visible in Technical Trace/Evidence.
- General policy enforcement remains independently observable; the UI distinguishes observed event, case evaluation, and final control verdict.
- An unexercised control remains `INCONCLUSIVE` even if a model happened not to take the unsafe action.

Likely files:

- `src/data/agentCases.js`
- `src/data/agentCases.test.js`
- `src/harness/runAgentAssessment.js`
- `src/harness/computeVerdict.js`
- New: `src/harness/evaluateCaseConditions.js`
- Evidence Contract builder/tests wherever the condition evaluation is attached.

Meaning-changing checkpoint:

Before changing the interpretation of an existing condition, document the proposed mapping from each signal name to an observed runtime field. If a signal has no reliable observation source, mark it unsupported/unknown and surface that limitation instead of inventing one.

### 1C. Preserve provider response fidelity

Problem:

`src/api/adapter.js` normalizes Anthropic responses to text and tool calls, then reconstructs the assistant turn from that reduced representation. Other provider-native content blocks can be lost. This is a transcript and evidence-fidelity gap even where today’s execution still works.

Required design:

- Preserve the provider-native assistant content needed to round-trip an assistant tool-use turn losslessly, or maintain a lossless normalized representation.
- Keep a presentation-safe normalized view separately from the provider continuation payload.
- Preserve relevant provider identifiers and block metadata in evidence records without persisting secrets.
- If an unsupported block cannot be retained safely, expose an explicit degraded/limitation state.
- Maintain provider isolation: OpenAI-format and Anthropic-format continuation paths should not leak assumptions into one another.

Tests:

- Round-trip mixed text and tool-use blocks.
- Round-trip multiple tool calls.
- Cover an additional non-text/unknown block without silently dropping it.
- Verify no API key enters a transcript, contract, persisted record, error message, or export.
- Keep existing API adapter tests green.

Likely file: `src/api/adapter.js` and its tests.

## Phase 2 — investigation workspace

### Information architecture

Replace the long, stacked result page with a stable workspace. After a run, the primary analysis navigation is:

- **Compare** — differences between exact run identities.
- **Trace** — chronological technical evidence and control decisions.
- **Evidence** — verdict basis, condition evaluations, evidence classes, scope, and limitations.
- **Report** — export and handoff.

Retain a persistent context summary showing:

- case and variant;
- profile;
- target/provider/model;
- judge and trial settings;
- configuration digest/fingerprint;
- state: running, current, stale, degraded, or error.

On narrow screens this may collapse into a summary disclosure, but the state and rerun action must remain visible.

### Compare

- Compare immutable completed runs, not current form settings.
- Identify each member by run ID, timestamp, manifest/configuration digest, profile, target, and model.
- Use a findings rail or concise summary for material differences.
- Highlight changed decisions, exercised gates, case-condition outcomes, evidence-class changes, and limitations.
- Keep unchanged low-value fields collapsed by default.
- Update `ComparisonStoryPanel.jsx` rather than creating a second unrelated comparison model.

### Trace

- Organize events into readable event types/lanes: model, tool proposal, gate decision, tool result, case signal, verdict, limitation.
- Distinguish `observed`, `derived`, and `analyst interpretation` data.
- Show provenance/source and confidence or determinism where relevant.
- Keep raw payloads available but collapsed by default.
- Borrow the “Threat Operations” visual language only here: sharper grid, restrained status signals, and dense telemetry. Do not make the whole application look like a theatrical SOC dashboard.

### Evidence

- Lead with the claim, verdict, and why it is supportable.
- Show the case-condition evaluation separately from general control enforcement.
- Present evidence class, independence, scope, limitations, and claim boundary together.
- Preserve the project’s exact caveats about simulation, local integrity, and unexercised controls.

### Report and export

`src/reports/reportGenerator.js` already supports sanitized Markdown, HTML, and JSON output, but the main UI does not expose it.

- Add Report navigation and export selected/current/comparison run sets.
- Include run identity, configuration digest, current/stale state at export time, condition evaluation, and limitations.
- Preserve HTML escaping and Markdown fence/structure hardening.
- A stale export must be intentional and clearly labeled historical.
- Export generation should be pure and unit-tested; downloading belongs in a thin UI utility.
- Keep the existing Evidence Contract JSON download if useful, but distinguish a contract from a human-readable report.

Likely files:

- `src/components/AgentCaseRunner.jsx`
- `src/components/ComparisonStoryPanel.jsx`
- `src/components/EvidenceContractPanel.jsx`
- Technical trace component(s)
- `src/reports/reportGenerator.js`
- New workspace navigation/context/report components as needed.

## Phase 3 — visual system, accessibility, and performance

### Visual direction: Forensic Dossier

The target is a sober investigative workbench, not a generic card dashboard.

- Shell: near-black obsidian.
- Primary text: warm bone/off-white.
- Interaction accent: restrained brass/amber.
- Verdict colors: reserved exclusively for held, failed, partial, inconclusive, degraded, and error semantics.
- Typography: Space Grotesk around 15–16 px for narrative/interface copy; Geist Mono only for IDs, hashes, event metadata, and code-like values. Use robust local/system fallbacks if fonts are not bundled.
- Reduce container borders substantially. Use spacing, headings, alignment, and quiet dividers before boxes.
- Avoid nested cards, repeated outlined panels, all-monospace narrative, tiny muted copy, gradients as decoration, and excessive uppercase labels.
- Use a clear density hierarchy: summary first, investigative detail second, raw payload third.

Add or consolidate semantic tokens before component-by-component restyling. Suggested groups:

- surfaces: canvas, raised, inset, overlay;
- text: primary, secondary, muted, inverse;
- interaction: accent, hover, focus, selected;
- verdict: held, partial, failed, inconclusive, degraded;
- spacing, radii, typography, and motion.

### Accessibility acceptance criteria

- Preserve and extend existing `:focus-visible` and reduced-motion behavior in `src/App.jsx`.
- Use semantic tab/section navigation with correct selected state and keyboard behavior.
- The full critical workflow is keyboard operable with a visible focus indicator.
- Running/current/stale/degraded/error updates are programmatically announced.
- Color is never the only carrier of verdict or stale state.
- Test text and non-text contrast, especially muted metadata and focus outlines.
- Verify reflow at 200% and 400% zoom and common narrow widths.
- Labels, error messages, disclosures, and raw-payload controls have accessible names and relationships.

### Browser-level tests and CI

Add Playwright or an equivalent browser test runner. If adding a dependency is undesirable, document and justify the alternative; do not substitute more unit tests for user-flow coverage.

Critical browser flows:

1. Configure → run → current result.
2. Change every execution-relevant setting → stale result with a field-level diff.
3. Rerun → new identity and current result.
4. Compare → exact original run contexts are preserved.
5. Export current result → correct identity and metadata.
6. Export stale result → warning/gate and historical label.
7. Keyboard navigation, focus order, tab semantics, and live status announcements.
8. Error and degraded paths do not masquerade as successful evidence.

Update `.github/workflows/ci.yml` to run browser tests. Prefer deterministic simulated targets in CI; live providers must not be required.

### Bundle work

- Generate inspectable bundle statistics before choosing optimizations.
- Identify which packages and modules dominate the main chunk.
- Preserve the existing lazy boundary around WebLLM and verify it is actually absent from the initial route chunk.
- Lazy-load heavy analysis panels/report tooling where it improves initial load without hiding state transitions.
- Add a measured performance budget to CI. Choose and document the threshold from the post-split baseline; do not use an arbitrary number merely to make CI green.
- Verify local-model loading and offline/local-first expectations after code splitting.

## Suggested module boundaries

This is guidance, not a requirement to rename working code.

| Responsibility | Preferred location |
|---|---|
| Canonical execution config and diff | `src/harness/runConfiguration.js` |
| Manifest and integrity hashing | `src/harness/runProvenance.js` |
| Case signal registry/evaluation | `src/harness/evaluateCaseConditions.js` |
| General control verdict | `src/harness/computeVerdict.js` |
| Assessment orchestration | `src/harness/runAgentAssessment.js` |
| UI session state | `src/hooks/useAssessmentSession.js` |
| Persistent context/state strip | `src/components/RunContextSummary.jsx` |
| Workspace navigation | `src/components/InvestigationWorkspace.jsx` |
| Human-readable export UI | `src/components/ReportPanel.jsx` |
| Pure export formats | `src/reports/reportGenerator.js` |

Keep pure security semantics out of React components. Components may render and orchestrate but should not independently decide whether a control held.

## Completion gates

Before declaring the work complete:

- [ ] Every result and comparison member has an immutable configuration snapshot and digest.
- [ ] All execution-relevant form changes create a visible stale state.
- [ ] Declared executable case signals are evaluated or explicitly reported unsupported.
- [ ] Case evaluation is traceable from observed source to Evidence Contract to UI/report.
- [ ] Provider assistant turns round-trip without silent content loss.
- [ ] Compare, Trace, Evidence, and Report operate on explicit run identities.
- [ ] Stale exports are intentional and labeled historical.
- [ ] Critical browser flows run in CI without live credentials.
- [ ] Keyboard, live-region, contrast, and reflow checks are recorded.
- [ ] Bundle composition is measured and a justified budget is enforced.
- [ ] `npm test`, `npm run lint`, `npm run build`, browser tests, and `npm audit --omit=dev` pass.
- [ ] Documentation reflects any new schema, limitations, or threat/evidence claims.

## Out of scope unless separately approved

- Real side effects or integrations that turn mock tools into operational actions.
- Server-side key storage, accounts, team collaboration, or cloud persistence.
- Claims of E4/E5 evidence, independent validation, regulatory compliance, or tamper-proof auditability.
- Rewriting the full application in another framework.
- Replacing established verdict vocabulary merely for visual simplicity.
- Adding live-provider CI tests that require secrets.

## Codex execution protocol

1. Read this file, the repository `README`, evidence-class documentation, relevant tests, and the files named in the active phase.
2. Confirm the baseline locally and report any discrepancy before changing semantics.
3. Work phase by phase. Start with Phase 1A, then 1B, then 1C.
4. Add failing tests first for each trust defect or, at minimum, demonstrate the failure before implementing the fix.
5. Keep changes small enough to review and preserve unrelated worktree changes.
6. Run focused tests during development and the full quality suite at every phase boundary.
7. Do not weaken an assertion or delete a test simply to make a new implementation pass.
8. Stop for clarification if a proposed mapping changes the meaning of an existing evidence or verdict claim.
9. Do not commit, push, deploy, or open a pull request unless explicitly asked.
10. At each checkpoint, report changed files, decisions, test results, remaining risks, and the exact next phase.

## Ready-to-paste kickoff prompt

```text
Work in this Sleeper repository and read docs/codex-implementation-handoff.md in full. Treat it as the implementation source of truth.

Begin with Phase 1 only: trustworthy run semantics (1A canonical run identity/stale state, 1B runtime case-condition evaluation, and 1C provider transcript fidelity). Do not begin the visual overhaul yet.

First inspect the relevant implementation and tests and confirm the documented baseline. Then implement Phase 1 in small, reviewable changes with tests. Preserve all non-negotiable trust rules, especially: simulated actions are never real, an unexercised control is never a hold, unknown case signals are inconclusive, evidence claims cannot be upgraded, and API keys cannot be persisted.

Reuse the existing run provenance/digest machinery where appropriate. Do not create a second verdict engine; connect typed case-condition evaluations to the existing general control verdict path. If a declared signal has no reliable runtime source, surface it as unsupported/unknown and stop for clarification before inventing semantics.

Run focused tests as you work, then run npm test, npm run lint, npm run build, and npm audit --omit=dev. Do not commit, push, deploy, or open a PR. When Phase 1 is complete, stop and report: changed files, architecture decisions, new/updated tests, exact command results, any semantics that need product approval, and the recommended Phase 2 sequence.
```
