# SLEEPER — Local-First Agent Assurance Lab

> Run agents against adversarial content in the browser. Watch the tool calls. Map the control gap.

---

## What This Is

SLEEPER tests whether an AI agent can be manipulated into taking an action it should not
take, and turns the result into reviewable evidence mapped to published control frameworks.

The question is not "did the model say something bad." It is:

> The model refused this injection in a single turn. Given tools, did it act on it anyway —
> and did anything stop it?

An agent's security properties live in the gap between what it *says* and what it *does*.
SLEEPER instruments that gap: a real tool-calling loop where the model genuinely decides
whether to call `send_email`, against mock tools where nothing actually leaves the browser.

It descends from [ELICIT](https://github.com/humintloop/ELICIT), a single-turn adversarial
assurance lab, and keeps ELICIT's evidence pipeline — structured cases, heuristic and judge
triage, reviewer disposition, framework-mapped findings, exportable reports. Single-turn
probes remain as the **baseline arm** of an agent case, not as the product.

## Status

Early. The framework mapping layer, evidence pipeline, and single-turn probe library are
working and inherited. The agent harness is being built — see
[`docs/agent-module-plan.md`](./docs/agent-module-plan.md) for scope, schedule, and the
source-verified crosswalk it is being built against.

## Threat Cases (v1 scope)

| Case | Scenario | Primary mapping |
|---|---|---|
| **1. Indirect injection → unauthorized action** | An employee points an agent at untrusted content — a ticket, a PR, an email, a scraped page. Hidden instructions in that content hijack the agent into an action nobody asked for. | `AML.T0051.001` + `AML.T0053` · ASI01 |
| **2. Excessive agency / insufficient approval** | The agent holds tool access to consequential, irreversible, or externally-visible actions with an approval gate that is missing, bypassable, or degrades under load. | `LLM03:2026` Excessive Agency · `AML.M0029` |
| **3. Malicious or over-permissioned MCP** | An agent is connected to an unsanctioned or compromised MCP server, or an internal one scoped far broader than the task needs. | `AML.T0110` · AIUC-1 `B006` |

Deferred to a later scope: memory poisoning (ASI06), inter-agent communication (ASI07),
identity spoofing.

## Evidence Discipline

Every finding records what it actually permits you to claim, on three axes:

- **Evidence class (E1–E5).** Observation → runtime characterization → enforcement →
  persistence/replay resistance → isolation. Nothing SLEEPER produces reaches E4 or E5, and
  it says so.
- **Oracle independence (I0–I2).** Who produced the verdict: self-authored, independently
  reimplemented, or an independent sensor the target does not control. SLEEPER is I0.
- **Status.** Mapped / executed / independently reviewed / certified. A framework crosswalk is
  E1 material regardless of how many requirements it covers.

Two consequences worth stating up front:

1. When SLEEPER blocks a tool call, that is enforcement **by SLEEPER's own gate**, and
   evidence about the target's behavior only. A mock-tool run does not establish that a
   production system would have blocked anything.
2. An unexercised control resolves to `INCONCLUSIVE`, never to "held." If the model never
   attempted the tool call, the tool-authorization control was not tested.

Taxonomy adapted from
[`msaleme/red-team-blue-team-agent-fabric`](https://github.com/msaleme/red-team-blue-team-agent-fabric)
(Apache 2.0). See [`ATTRIBUTION.md`](./ATTRIBUTION.md).

## Framework Traceability

Findings map to MITRE ATLAS, the OWASP Top 10 for LLM Applications, the OWASP Top 10 for
Agentic Applications, AIUC-1, NIST AI RMF, ISO/IEC 42001 §9, and conditional EU AI Act
readiness notes.

Every framework reference is pinned to a source version in
[`docs/source-ledger.md`](./docs/source-ledger.md), which also records whether each mapping is
**direct** (the source asserts the relationship) or **inferred** (this project asserts it).
Most are inferred, and the ledger says which.

Current pins: MITRE ATLAS content v2026.07 · OWASP LLM Top 10 2026 · OWASP Agentic Top 10 2026
· AIUC-1 2026-07-15.

## Responsible Use

For authorized security research, internal AI assurance, and evaluation of systems you own or
have explicit permission to test. Do not use against production AI systems without
authorization.

Framework mappings are control traceability aids. They are **not** legal conclusions, audit
determinations, certification evidence, or findings of noncompliance. No SLEEPER output is a
conformity assessment against any standard.

Mock tools never take real actions — no email is sent, no file is written, no API is called.
Every run carries `simulated_only` so a mock effect is never mistaken for a real one.

Attribution and sources: [`ATTRIBUTION.md`](./ATTRIBUTION.md),
[`docs/source-ledger.md`](./docs/source-ledger.md). Security reports: [`SECURITY.md`](./SECURITY.md).
Licensed Apache 2.0; see [`LICENSE`](./LICENSE).

## Local Setup

```bash
npm install
npm run dev
```

Requires a desktop browser with WebGPU (Chrome, Edge, or Arc). Models download into browser
storage on first load and are cached there.

```bash
npm test    # vitest
npm run lint
npm run build
```

## Targets

- **Local (WebLLM/WebGPU)** — models run entirely in the browser. Nothing leaves the machine.
  Small models call tools unreliably; the harness has a JSON-emit fallback and records when it
  is used rather than hiding the degradation.
- **Live API (Anthropic first)** — probes and agent runs against a real endpoint. The API key
  is held in memory for the session and never written to storage.

## Limitations

- Evaluates model behavior in a lab. It does not prove production exploitability.
- Results vary by model, runtime, quantization, prompt, context, and temperature.
- Heuristics are triage aids, not ground truth. The LLM judge can be biased or influenced;
  treat it as supporting evidence.
- Browser inference is bounded by GPU memory, WebGPU support, cache storage, and tab lifecycle.
- ISO/IEC 42001 and EU AI Act relevance depends on system role, scope, risk classification,
  jurisdiction, and deployment context. High-risk *readiness* is not high-risk *classification*.

## Roadmap

See [`docs/agent-module-plan.md`](./docs/agent-module-plan.md). Near-term: port the control
profile and authority registry layer, add tool-calling to the API adapter, build the ReAct
orchestrator, wire agent runs into the existing findings and report pipeline.
