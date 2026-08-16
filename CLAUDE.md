# NETRUNNER — working notes

Local-first browser lab for **agentic** AI threat evaluation. Tests whether an agent can be
manipulated into taking an action it should not take, and turns the result into reviewable
evidence mapped to published control frameworks.

Read [`docs/agent-module-plan.md`](docs/agent-module-plan.md) first. It is the live design
doc: scope, the source-verified framework crosswalk, the harness architecture, and the
week-by-week schedule. Everything below is context that doc assumes.

## Lineage

Copied from [humintloop/ELICIT](https://github.com/humintloop/ELICIT) on 2026-08-16, right
after a repo-wide framework refresh, then stripped of ELICIT's dossier framing and rebuilt
around agent threats. **ELICIT stays live and unchanged** as the single-turn lab — do not
treat this repo as its replacement in anything user-facing.

A third fork, [humintloop/ORPHEUS](https://github.com/humintloop/ORPHEUS), is being retired.
It contains a working agentic harness, control-profile model, Evidence Contract schema, and a
live OpenAI/Anthropic API adapter that this project is porting *from*. See the salvage
assessment in the plan doc — it lists what to take and what to throw out, including two real
defects in ORPHEUS's `computeVerdict.js` that must not be carried over.

## Stack

Vite + React 18, no router, no state library. WebLLM (`@mlc-ai/web-llm`) for local inference.
Vitest + ESLint. Deploys to GitHub Pages via `npm run deploy`.

```bash
npm run dev     # via .claude/launch.json config "netrunner-dev", port 5173
npm test
npm run lint
npm run build
```

WebGPU + cross-origin isolation are required for local inference; `public/coi-serviceworker.js`
forces it on Pages. Desktop browsers only — mobile is blocked deliberately by `CompatGate`.

## Layout

| Path | Role |
|---|---|
| `src/App.jsx` | Everything: stages, run loop, judge, batch, export. ~2500 lines. `STAGE` at the top is the state machine. |
| `src/payloads.js` | `TECHNIQUES` (ATLAS metadata + judge prompts), payload library, `evaluateResponse` heuristic. |
| `src/data/frameworkMappings.js` | Control set, framework references, `OWASP_PUBLISHED_CROSSWALK`, `FRAMEWORK_VERSIONS`. |
| `src/data/mitigationMappings.js` | ATLAS mitigation refs + project-defined action guidance. |
| `src/reports/reportGenerator.js` | Markdown / JSON / HTML export. |
| `src/storage.js` | localStorage keys (all `netrunner-*`) and teardown. |
| `controls/`, `docs/` | Project-defined control set and framework relevance notes. |
| `src/harness/` | **Does not exist yet.** Where the agent harness lands. |

## Conventions that matter

**Colors live in the `C` object** at the top of `App.jsx`. Never hardcode a hex outside it.
Verdict colors (red/teal/amber/blue for SUCCESS/FAILURE/PARTIAL/REVIEW) are reserved — a
technique cluster's color must never read as an outcome.

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
(mapped/executed/independently reviewed/certified). Nothing here reaches E4 or E5. An
unexercised control resolves to `INCONCLUSIVE`, never "held" — if the model never attempted
the tool call, the tool-authorization control was not tested. The plan doc §"Borrowed"
explains why this matters.

**Mock tools never act.** No email sent, no file written, no API called. Every run carries
`simulated_only`. A mock effect must never be presentable as a real one.

## Current state

Framework layer, evidence pipeline, and single-turn probe library work and are tested
(30 tests). Single-turn is the **baseline arm** of an agent case, not the product — the
comparative claim is the point: *the model refused this injection in a single turn; given
tools, did it act on it anyway?*

Next up is week 2 of the plan: port ORPHEUS's `authorityRegistry`, the four control functions,
`controlProfiles`, and `controlGate` into `src/harness/`, each landing with Vitest coverage.
Then Anthropic tool-calling in the API adapter, then the ReAct orchestrator.

Live API target is **Anthropic first**. The adapter holds the key in memory for the session
and never writes it to storage. Keep it that way.

## Deadline

Working end-to-end demo of all three threat cases before Offensive AI Con, Oceanside CA,
Oct 4–7 2026.
