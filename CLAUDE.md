# SLEEPER — working notes

Local-first browser lab for **agentic** AI threat evaluation. Tests whether an agent can be
manipulated into taking an action it should not take, and turns the result into reviewable
evidence mapped to published control frameworks.

Read [`docs/agent-module-plan.md`](docs/agent-module-plan.md) first. It is the live design
doc: scope, the source-verified framework crosswalk, the harness architecture, and the build
history. Read [`docs/remove-single-turn-flow.md`](docs/remove-single-turn-flow.md) too — it
records why and how the single-turn probe flow was removed; several files that doc references
no longer exist, which is expected, not a stale link.

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
live OpenAI/Anthropic API adapter that this project ported *from*. See the plan doc's salvage
assessment for what was taken as-is, what was rewritten, and the defects found in ORPHEUS's
`computeVerdict.js` and `mockToolRouter.js` that were not carried over.

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
| `src/App.jsx` | The whole shell. ~125 lines: token object `C`, `STAGE` (`HOME` / `AGENT_LAB` only), `GlobalStyle`, and a two-branch render. No compatibility gating or business logic lives here — device/capability checks are scoped to `AgentCaseRunner`'s Local Model target, and everything else is in `src/harness/`. |
| `src/components/DossierHome.jsx` | Home screen. One entry point: "Run agent case." Headline copy leads with the Baseline-vs-Reference control-profile comparison. |
| `src/components/AgentCaseRunner.jsx` | **Start here for the UI.** Case + profile + target (live API or local model) → run → trace/verdict/contract, plus run history read from `storage.js`. |
| `src/harness/runAgentAssessment.js` | **Start here for the logic.** Case + profile + target → run → verdict → contract. `runCaseAcrossProfiles` is the comparative arm. |
| `src/harness/runAgentCase.js` | The ReAct loop. Owns provenance attribution, the turn cap, and the loop guard. |
| `src/harness/` | `authorityRegistry.js` (tool trust boundaries), `controlGate.js` (profile → system-prompt wrapper), `controls/*` (four control functions), `mockToolRouter.js`, `computeVerdict.js`, `evidenceContract.js`, `webllmLocalTarget.js` (local-model target, prompted-JSON tool-call fallback). |
| `src/api/adapter.js` | Live-target adapter. OpenAI / Anthropic / generic, tool-calling, local JSON fallback, `describeDegradation` for readable degradation reasons. Key is a private class field — keep it that way. |
| `src/data/agentCases.js` | The four threat cases (`NR-AGT-001/002/003A/003B`), fixtures, and framework mappings. |
| `src/data/controlProfiles.js` | Baseline / Partial / Reference / Custom control postures. |
| `src/data/victimModels.js` | Shared WebLLM model catalog for the local target. |
| `src/data/frameworkMappings.js` | Control set, framework references, `OWASP_PUBLISHED_CROSSWALK`, `FRAMEWORK_VERSIONS`. |
| `src/data/mitigationMappings.js` | ATLAS mitigation refs + project-defined action guidance. |
| `src/reports/reportGenerator.js` | Markdown / JSON / HTML export, built around the agent-run + Evidence Contract shape — not the deleted probe-finding shape. |
| `src/storage.js` | `AGENT_RUNS_KEY` only — completed agent runs, capped at 20. No probe-flow state persists; there is no "resume a half-configured case" concept in agent mode. |
| `controls/`, `docs/` | Project-defined control set and framework relevance notes. |

## Conventions that matter

**Colors live in the `C` object** at the top of `App.jsx`. Never hardcode a hex outside it.
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

**Evidence discipline** (adopted from `msaleme/red-team-blue-team-agent-fabric`, Apache 2.0):
findings carry an evidence class E1–E5, oracle independence I0–I2, and a status
(mapped/executed/independently reviewed/certified). Nothing here reaches E4 or E5 — enforced by
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

Agent-only, wired end to end in the browser: pick a case, pick a control profile, point it at a
live API target or a local WebLLM model, run it, and see the ReAct trace, the verdict, and the
Evidence Contract. `runCaseAcrossProfiles` runs the comparative arm — same case, same model,
Baseline vs. Reference — which is the headline demonstration, not single-turn-vs-agent.

463 tests, lint clean, build succeeds. The single-turn probe flow (`payloads.js`, `clusters.js`,
`FindingCard`, `FindingsReport`, the batch/judge machinery, and five other components) was
deleted outright on 2026-08-17 rather than kept alongside agent mode — see
[`docs/remove-single-turn-flow.md`](docs/remove-single-turn-flow.md) for the reasoning and the
sequenced removal this repo actually went through.

Two framework-mapping judgment calls remain project-defined rather than sourced, and are
flagged as such in `docs/agent-module-plan.md`: the AIUC-1 3a/3b requirement allocation, and
two inferred OWASP LLM mappings (case 1's LLM01, case 3b's LLM04).

Live API target is **Anthropic first**. The adapter holds the key in memory for the session
and never writes it to storage. Keep it that way.

## Deadline

Working end-to-end demo of all four threat cases before Offensive AI Con, Oceanside CA,
Oct 4–7 2026.
