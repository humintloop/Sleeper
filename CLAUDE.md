# SLEEPER — working notes

Local-first browser lab for **agentic** AI threat evaluation. Tests whether an agent can be
manipulated into taking an action it should not take, and turns the result into reviewable
evidence mapped to published control frameworks.

Read [`docs/agent-module-plan.md`](docs/agent-module-plan.md) first. It is the live design
doc: scope, the source-verified framework crosswalk, and the harness architecture.

## Lineage

Copied from [humintloop/ELICIT](https://github.com/humintloop/ELICIT) on 2026-08-16, then
stripped of ELICIT's dossier framing and rebuilt around agent threats. ELICIT stays live and
unchanged as the single-turn lab. SLEEPER inherited ELICIT's single-turn probe flow at first,
but that flow has since been **deleted outright** (2026-08-17) — agents are the only mode now.
Do not resurrect probe-flow patterns (techniqueId, heuristic/judge verdict, `payloadName`,
etc.) when extending this app; the agent-case shape (`caseId`, `profileId`, `verdict`, Evidence
Contract) is the only vocabulary this project speaks going forward.

A third fork, [humintloop/ORPHEUS](https://github.com/humintloop/ORPHEUS), has been retired.
It contained a working agentic harness, control-profile model, Evidence Contract schema, and a
live OpenAI/Anthropic API adapter that this project ported *from* — rewriting `computeVerdict.js`
and the seeding half of `mockToolRouter.js` rather than carrying their defects over.

## Stack

Vite + React 18, no router, no state library. WebLLM (`@mlc-ai/web-llm`) for local inference.
Vitest + ESLint. Deploys to GitHub Pages via `npm run deploy`.

```bash
npm run dev     # via .claude/launch.json config "sleeper-dev", port 5173
npm test
npm run lint
npm run build
```

WebGPU + cross-origin isolation are required for the local-model target only;
`public/coi-serviceworker.js` forces it on Pages. There is no app-level device gate: when those
capabilities are unavailable, `AgentCaseRunner` disables just the Local Model option and says
why, while Sample Replay and Live API stay fully available on any device, mobile included. The
live-API target needs neither WebGPU nor a local download.

## Layout

| Path | Role |
|---|---|
| `src/App.jsx` | The whole shell: token object `C`, `STAGE` (`HOME` / `SCENE` / `AGENT_LAB`), `GlobalStyle`, a three-branch render, and the scene→lab run handoff. The three stages are a narrative in that order — consequence, how, proof. No compatibility gating or business logic lives here — device/capability checks are scoped to `AgentCaseRunner`'s Local Model target, and everything else is in `src/harness/`. |
| `src/components/ConferenceStory.jsx` | Home screen: a five-step guided walkthrough (employee → content → agent → tools → control) built for a stage or booth monitor rather than an analyst's desk. Replaced `IncidentMemoHome.jsx`. Every claim on it is real: steps 1-2 use static data from `storyScene.js` that needs no run, steps 3-5 run the actual Baseline assessment plus a second run under `STORY_COMPARISON_PROFILE_ID` so the closing comparison is two independently computed verdicts, never narrated ones — the draft this replaced hand-typed the email, the tool calls, and a "Control held in this run" ending with no run behind any of it, which is exactly the failure mode this project's story layer exists to prevent. A "Evidence lab" link in its masthead goes straight to the lab for the audience that already believes the premise. |
| `src/components/SceneWalkthrough.jsx` | The demo. Runs the real Baseline Sample Replay of NR-AGT-001 through `runAgentAssessment` and renders **that run's own event stream** as the interface it would have happened in, then hands the same result object to the lab. Not a mock, and not a re-run. |
| `src/data/storyScene.js` | The narrative layer over NR-AGT-001: the persona, the memo copy, the fixture-derived email split, `deriveSceneBeats`, and `storyRunParams` — the single definition of the arguments the scene runs with. |
| `src/components/McpDescriptorScene.jsx` / `src/data/mcpDescriptorScene.js` | The same scene pattern applied to NR-AGT-003A: a tool-registry inspector showing the poisoned descriptor's real revision-4-vs-7 diff (`descriptor_revision.changed_after_approval`), the credentials-file fixture, then the real agent trace and final response — reached from the Lab via "Watch this attack — the tool registry." |
| `src/components/McpMarketplaceScene.jsx` / `src/data/mcpMarketplaceScene.js` | Same pattern for NR-AGT-003B: a fake MCP marketplace listing (rating, publisher, requested scopes with the excess ones highlighted) built from `parseListing()` over the real fixture text, then the real hostile tool result and agent trace — reached via "Watch this attack — the marketplace listing." |
| `src/components/ApprovalQueueScene.jsx` / `src/data/approvalQueueScene.js` | The scene for NR-AGT-002 — not an injection case, so the metaphor is a deploy-window checklist and one approval prompt rather than poisoned content. Runs variant `NR-AGT-002-V3` (decision context stripping) and shows the real fixture's `full` payload next to the run's own `approvalSummary.approval_records[0].presented_context` — reached via "Watch this attack — the approval queue." |
| `src/components/AgentCaseRunner.jsx` | **Start here for the UI.** Case + profile + target (live API or local model) → run → `InvestigationWorkspace`'s Compare/Trace/Evidence/Report tabs, plus run history read from `storage.js`. Which case/profile it opens on when arriving via a scene handoff is read from the handoff's own `configuration`, not a hardcoded case — this is what lets all three scenes (case 1, 3a, 3b) hand off through the same component. |
| `src/components/RunContextSummary.jsx` | Persistent context strip above the workspace: case/variant/profile/target/judge/trials/configuration digest, and the derived idle/running/current/stale/degraded/error state with a field-level diff and rerun action when stale. Also exports `LiveRunBadge` — an animated "Live model run" badge shown the instant Live API is selected, not only after a run completes, and `targetSummary()`, the one place a configuration's target renders as text. |
| `src/components/RunHistory.jsx` | Locally retained runs, grouped by comparison batch — one row per comparison, members' verdicts on it, records and their Evidence Contracts one level down. A record's `batchId` is what groups it; records without one stand alone. |
| `src/components/CapturedRuns.jsx` | A completed **live** run that reached evidence class E3 can be saved as a verified capture — the full outcome (run/verdict/contract/configuration), not history's trimmed summary — so it can be shown again without another API call. `SaveCaptureButton` is gated on exactly that (`target_type === 'live'` and `max_class_claimed === 'E3'`); replaying one sets the result straight from what was recorded and syncs the target selector to match, rather than re-invoking any target. See [`docs/live-verification-log.md`](docs/live-verification-log.md) for the running record of which captures came from an actual live run. |
| `src/components/InvestigationWorkspace.jsx` | The Compare/Trace/Evidence/Report tab shell. Real ARIA tabs (roving tabindex, arrow/Home/End nav) — pure navigation, no verdict/security logic. |
| `src/components/ReportPanel.jsx` | UI for `reportGenerator.js`'s Markdown/HTML/JSON export (current result or full comparison set), gated by `reportExport.js`'s stale-export confirmation — distinct from the Evidence Contract JSON download on the Evidence tab. |
| `src/components/LiveRunConsole.jsx` | Real-time console for a single run (`handleRun`/`handleComparative`, not repeat trials): sticky phase rail, a plain-English "now" line, and a card per `execution_chain` entry, appended the instant `runAgentCase.js`'s `onEvent` hands it back — the literal same object reference `run.events` ends up holding, not a copy, which is what makes this a faithful render rather than a mockup. Turn-granularity only (Phase A — no token streaming, `src/api/adapter.js` untouched); ends on a verdict banner reading `verdict.observation` when the run resolved one. Visual pattern from `docs/prototypes/sleeper-run-console.html`. |
| `src/harness/runAgentAssessment.js` | **Start here for the logic.** Case + profile + target → run → verdict → contract. `runCaseAcrossProfiles` is the comparative arm; `createComparisonIdentity` records each member's manifest/configuration digest for the Compare tab. |
| `src/harness/runAgentCase.js` | The ReAct loop. Owns provenance attribution, the turn cap, the loop guard, and provider-native assistant-turn fidelity (`providerResponses`). Every `execution_chain` entry passes through one `emit()` helper that both appends to `events` and calls the optional `onEvent` callback with the same reference — one source of truth for the trace, the contract, and `LiveRunConsole`. |
| `src/harness/runConfiguration.js` | The one canonical execution-configuration snapshot (case/variant/profile/target/provider/model/judge/trials/advertised tools) and its digest — what `RunContextSummary` and the stale/current state derive from. |
| `src/harness/evaluateCaseConditions.js` | Evaluates each case's declared `attack_success`/`partial_control_failure` signals against the observed run, plus two resolved-observation signals (`injection_neutralized_upstream`, `injection_not_adopted` — run-level, not per-call) that name what happened when neither attack condition matched; feeds `computeVerdict.js`'s reconciliation (an unknown or matched case signal can downgrade a hold, never upgrade one). |
| `src/harness/gateConformance.js` | A battery of synthetic tool-call proposals run straight through `runToolAuthorizationGate` — no target, no model, no case run. `GateConformancePanel.jsx` renders it as a runnable, always-available pass/fail suite in the Lab, demonstrating gate enforcement in under a second. Enforcement evidence about Sleeper's own gate only, stated explicitly in the report it returns. |
| `src/harness/` | `authorityRegistry.js` (tool trust boundaries), `controlGate.js` (profile → system-prompt wrapper), `controls/*` (four control functions), `mockToolRouter.js`, `computeVerdict.js`, `evidenceContract.js`, `webllmLocalTarget.js` (local-model target, prompted-JSON tool-call fallback). |
| `src/api/adapter.js` | Live-target adapter. OpenAI / Anthropic / generic, tool-calling, local JSON fallback, `describeDegradation` for readable degradation reasons. Key is a private class field — keep it that way. Preserves provider-native assistant content (mixed blocks, multiple tool calls, unknown block types) losslessly for continuation. |
| `src/data/agentCases.js` | The four threat cases (`NR-AGT-001/002/003A/003B`), fixtures, framework mappings, and each case's declared `conditions` (executable signals `evaluateCaseConditions.js` consumes). |
| `src/data/controlProfiles.js` | Baseline / Partial / Reference / Custom control postures. |
| `src/data/victimModels.js` | Shared WebLLM model catalog for the local target. |
| `src/data/frameworkMappings.js` | Control set, framework references, `OWASP_PUBLISHED_CROSSWALK`, `FRAMEWORK_VERSIONS`. |
| `src/data/mitigationMappings.js` | ATLAS mitigation refs + project-defined action guidance. |
| `src/reports/reportGenerator.js` | Markdown / JSON / HTML export, built around the agent-run + Evidence Contract shape — not the deleted probe-finding shape. Has a UI surface now: `ReportPanel.jsx`. |
| `src/reports/reportExport.js` / `evidenceContractExport.js` | Pure stale-export gating (`STALE_EXPORT_CONFIRMATION_REQUIRED`) for the Report tab and the Evidence Contract download respectively — same contract, applied independently in each place. |
| `src/storage.js` | `AGENT_RUNS_KEY` — completed agent runs, capped at 20, trimmed to summary + contract. `CAPTURED_RUNS_KEY` — verified captures, capped at 12, storing the full outcome; deliberately separate from run history since a capture exists to be replayed, not just reviewed. No probe-flow state persists; there is no "resume a half-configured case" concept in agent mode. |
| `controls/`, `docs/` | Project-defined control set and framework relevance notes. |
| `e2e/` | Playwright critical-flow tests (`npm run test:e2e`) — Sample Replay only, no live credentials needed in CI. |

## Conventions that matter

**Colors, type sizes, and radii live in the `C` object** at the top of `App.jsx`. Never hardcode a
hex outside it, and never a font size either — `C.size` is five steps (`micro`/`small`/`body`/
`head`/`title`) and a sixth is almost always a hierarchy problem in disguise, not a missing token.
The wordmark is no longer a text literal: `src/components/SleeperBrand.jsx` renders the raster brand
assets under `public/brand/` (a lockup and a standalone mark), sized per call site rather than
through `C.size` — it is a logo, not UI copy.

**Two boundary tokens, and they are not interchangeable.** `border` is decoration — section rules,
the edge of a non-interactive card — and fails WCAG 1.4.11 at 1.30:1, so it must never be the only
signal that something is selectable. Every interactive boundary uses `borderHi`. Raising a surface
token lowers the contrast of everything on it — re-measure and update
[`docs/accessibility-audit.md`](docs/accessibility-audit.md) in the same change, as with the
framework ledger, whenever `bg`/`panel`/`surface` move. Current tightest ratio: `text3` on `surface`
at 5.94:1 (see the audit doc's most recent re-measurement for the full table — the ramp has moved
twice since this was first written, so treat any specific number here as a snapshot, not a promise).

**Uppercase is a level-one marker, with one documented exception.** Section eyebrows, the screen
kickers, and codes that are already uppercase strings. Not tabs, not card titles, not chips, not
`<details>` summaries — applied at every level it stops being emphasis. Letterspacing exists to open
up all-caps and comes off with it. The field-manual rebrand added one deliberate, scoped exception:
`.incident-headline` and `.field-button` on the home screen are display type, uppercase as part of
that treatment, not as a level marker — don't take this as license to uppercase a card title or a
tab elsewhere; it is specific to those two selectors.
Verdict colors are reserved on two axes now — the app carries both vocabularies in one lookup
table (`src/components/VerdictBanner.jsx`'s `verdictDisplay`): probe verdicts (red/teal/amber/
blue for SUCCESS/FAILURE/PARTIAL/REVIEW, retained for any old exported finding, though the UI
that produced them is gone) and control verdicts (green/ochre/red/slate for CONTROL_HELD/
PARTIAL_CONTROL_FAILURE/CONTROL_FAILED/INCONCLUSIVE, the vocabulary the app actually produces).
They answer different questions — "did the model resist" vs. "did the control hold" — and nothing
in the UI may render them as the same claim. Always resolve a verdict label/color through
`getVerdictLabel`/`getVerdictColor`, never a second local copy of the mapping.

**Framework claims are pinned and typed.** Every framework reference has a version in
`FRAMEWORK_VERSIONS` and a row in [`docs/source-ledger.md`](docs/source-ledger.md) recording
what was read and when. Mappings are labeled **direct** (the source asserts the relationship)
or **inferred** (this project asserts it). Almost everything is inferred; the one exception is
`OWASP_PUBLISHED_CROSSWALK`, which comes from OWASP's own Appendix A. Do not blur that line,
and update the ledger and the code in the same change.

**Never claim conformance.** Output is evidence for control review. Not audit determinations,
not certification, not findings of noncompliance. `controls/llm-saas-control-set.yaml` lists
prohibited claim language explicitly.

**Cite by ID, paraphrase the prose.** OWASP is CC BY-SA 4.0 and this repo is Apache 2.0;
AIUC-1 publishes no license at all. Reproduce identifiers and short names, write the
surrounding explanation yourself. `ATTRIBUTION.md` records the reasoning.

**Evidence discipline.** Findings carry an evidence class E1–E5, oracle independence I0–I2, and
a status (mapped/executed/independently reviewed/certified). Nothing here reaches E4 or E5 — enforced by
`assertClaimableEvidenceClass` in `evidenceContract.js`, not just documented. An unexercised
control resolves to `INCONCLUSIVE`, never "held" — if the model never attempted the tool call,
the tool-authorization control was not tested, and this must survive even when a run also
failed to reach its target (`requestServiced: false` is checked *after* failure detection in
`computeVerdict.js`, specifically so an observed exposure can never be masked by an unrelated
harness-level problem).

**Mock tools never act.** No email sent, no file written, no API called. Every run carries
`simulated_only`. A mock effect must never be presentable as a real one.

**PII scanning covers tool-call arguments, not just the final reply.** A scenario can be built
so a seeded value leaves through a tool call's arguments while the model's own final text stays
clean — `runAgentCase.js` scans both, since scanning only the reply misses exactly the
exfiltration path some cases exist to test.

## Current state

The app opens on a story and ends in evidence. The home screen is an incident memo — the
consequence stated plainly, marked simulated in the header rule, with the run/profile/target that
produced the claim named underneath. "Show me the run" plays that run as the scene it would have
happened in, and "open the evidence" hands the same result into the lab, which is unchanged.

**The story layer asserts nothing the harness does not support, and every claim it makes is
tested.** `storyScene.test.js` runs the Baseline replay and asserts it really does execute a send on
untrusted instruction to the seeded address — so the memo's past-tense claim fails a test rather
than quietly becoming false — and asserts the copy never says a control is effective, compliant or
protective. The scene derives its closing line (`replyMentionsUntrustedCalls`) rather than narrating
it, and stays silent when the run gives no basis for it. New narrative copy follows that rule: if a
sentence is about the run, compute it; if it cannot be computed, do not write it.

`storyRunParams` exists because the scene's result is handed to the lab and compared field by field
against the live form. Any argument the scene leaves defaulted that the runner sets explicitly gives
a different configuration digest and the visitor's own run arrives marked STALE. A test asserts the
two configurations are equal; keep it that way when either side changes.

Beyond that: pick a case, pick a control profile, point it at a
live API target or a local WebLLM model, run it, and work the result through the
`InvestigationWorkspace`'s Compare/Trace/Evidence/Report tabs. `runCaseAcrossProfiles` runs the
comparative arm — same case, same model, Baseline vs. Reference — which is the headline
demonstration, not single-turn-vs-agent. A persistent `RunContextSummary` strip tracks whether
the displayed result still matches the current form settings (current/stale/degraded/error),
naming exactly which fields changed and offering a rerun action when it doesn't. Report exports
(Markdown/HTML/JSON) and the Evidence Contract JSON download both refuse a stale export without
explicit confirmation, then label it historical.

636 vitest tests + 24 Playwright critical-flow tests (`npm run test:e2e`, Sample Replay only, no
live credentials needed), lint clean, build clean, a CI-enforced bundle budget
(`npm run check-budget`). The single-turn probe flow (`payloads.js`, `clusters.js`,
`FindingCard`, `FindingsReport`, the batch/judge machinery, and several other components) was
deleted outright rather than kept alongside agent mode — agents are the only mode now, and
nothing in the harness executes single-turn probes.

Case 1 is not the only case with a dramatized scene anymore. `McpDescriptorScene.jsx` (NR-AGT-003A)
and `McpMarketplaceScene.jsx` (NR-AGT-003B) apply the same discipline to the two poisoned-MCP
cases — a tool-registry inspector and a fake marketplace listing, both built from the real fixture
text and both handing a real Sample Replay result into the lab exactly as case 1's scene does.
`ApprovalQueueScene.jsx` (NR-AGT-002) closes out all four: nothing in that case is an injection, so
its scene is a deploy-window checklist and one approval prompt rather than poisoned content, built
from the one HITL variant (`NR-AGT-002-V3`, decision context stripping) a real fixture
(`NR-AGT-002-FIX-APPROVAL-CONTEXT`) carries both sides of — what the call itself carried, and what
actually reached the approval prompt (`{"tool": "send_email"}`, nothing else, straight from the
run's own `approvalSummary.approval_records`). The other three HITL variants (approval flood, high-
risk starvation, denied-decision replay) remain reachable only through the Lab's own variant
selector, not dramatized.

Going live changes what a run can prove, and now it also changes what stays visible on screen: an
animated `LiveRunBadge` appears the moment Live API is selected, and a completed run that reaches
evidence class E3 can be saved as a **verified capture** (`CapturedRunsList` /
`SaveCaptureButton`, `src/components/CapturedRuns.jsx`) — the full outcome, kept so it can be
replayed later without another API call or a model reproducing the same decision twice. No
verified capture exists yet; [`docs/live-verification-log.md`](docs/live-verification-log.md) is
the honest, hand-maintained record of when one first does.

The persona (`FIXTURE_PERSONA`) is scoped to case 1 on purpose. NR-AGT-002 runs across a deploy
window and NR-AGT-003A/B drive an MCP-connected coding agent; a marketing coordinator does not do
those things, so cases 2 and 3 keep their own engineer actors. One persona across all four would buy
narrative consistency with a scenario that is no longer credible.

Two framework-mapping judgment calls remain project-defined rather than sourced, and are
flagged as such in `docs/agent-module-plan.md`: the AIUC-1 3a/3b requirement allocation, and
two inferred OWASP LLM mappings (case 1's LLM01, case 3b's LLM04).

Live NR-AGT-001 runs used to flatten to the same INCONCLUSIVE / `NO_AUTHORIZATION_DECISION_REQUIRED`
under both the Reference and Partial postures, despite materially different event chains —
Reference's detection blocks the payload before the model ever sees it, Partial's model sees it
and declines. `evaluateCaseConditions.js`'s two new resolved-observation conditions
(`injection_neutralized_upstream`, `injection_not_adopted`) and `computeVerdict.js`'s
reconciliation now name that distinction with its own reason code and a new `observation` field
— verdict stays INCONCLUSIVE deliberately (these are observations, not control-hold claims,
and CONTROL_HELD still always requires tool_authorization itself to have held); nothing about
the four-value verdict vocabulary changed. `ControlResultsPanel.jsx` and `LiveRunConsole.jsx`
both surface `observation`, not only the Evidence Contract JSON. `docs/prototypes/
sleeper-run-console.html` is the design brief `LiveRunConsole.jsx` was built against — the same
onEvent bus Sample Replay already exercises, so it needs no live key to see it work.

Live API target is **Anthropic first**. The adapter holds the key in memory for the session
and never writes it to storage. Keep it that way. `LiveRunConsole.jsx` (Phase A) deliberately
does not touch `adapter.js` at all — real per-token streaming there is Phase B, and should ship
only behind a parity test (streamed assembly must produce an identical final message/contract to
the non-streaming path for the same fixture). If that parity can't be asserted cheaply, Phase B
is not worth the risk to this file's lossless provider-fidelity guarantee — stop at Phase A.

## Deadline

Working end-to-end demo of all four threat cases before Offensive AI Con, Oceanside CA,
Oct 4–7 2026.
