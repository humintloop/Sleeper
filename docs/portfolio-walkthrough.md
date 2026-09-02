# Sleeper: 7-minute portfolio walkthrough

## Read this first: what the default path proves

This walkthrough opens on **Sample Replay**, selected by default. State this bluntly, up front,
before showing anything: that path is scripted and deterministic — chosen for demo reliability,
not to imitate a model. It exercises the real harness, the real deterministic gates, and the
real Evidence Contract pipeline end to end, but no model makes a decision anywhere in it. It
proves the harness and its gates hold together. It is not model-behavior evidence, and a
skeptical viewer should never be left thinking the hijack moment on screen was model-driven when
it was scripted. Live-model runs are what evidence model behavior — the pivot to one is a
numbered step in the flow below (step 4), not an optional aside at the end.

## The claim

Model safeguards are not an authorization boundary. An enterprise agent consumes untrusted
content and can request consequential tools, so deterministic controls around the model must
constrain actions and retain honest evidence.

## 0:00–1:00 — Set the trust boundary

Open **Run agent case**. Keep **Sample Replay** selected and repeat the disclosure above out
loud: scripted path, no model decision, harness and gate evidence only. All tool effects are
simulated. The target side is E1; an exercised Sleeper gate can be E3 evidence about that gate
only.

## 1:00–4:00 — Hero case: indirect email injection

1. Select **Indirect injection → unauthorized action** and click **RUN & COMPARE CONTROLS**.
   This runs Baseline, Partial, and Reference against the identical scripted malicious path —
   still Sample Replay, still E1 for the target.
2. Read the comparison row: Baseline fails, Partial is incomplete, and Reference holds within
   the exercised scope. Open the collapsed technical trace and follow the employee request to
   the external email, the hidden instruction, the internal data retrieval, and the attempted
   outbound action. Point out the instruction source and trust label on the tool intent.
3. Open the Evidence Contract. Show the run-manifest digests, the evidence ceiling, the
   simulation boundary, and the unsigned-integrity warning. Note `target.class: E1` — this is
   the harness-and-gate evidence the disclosure promised, nothing more yet.
4. **Pivot to model-behavior evidence.** Switch **Target** to **Live API** (or **Local Model**,
   if hardware and WebGPU permit) and click **RUN & COMPARE CONTROLS** again on the same case —
   this is the same three-profile comparison button, now driving a real model instead of the
   scripted fixture; it is not replay-only. Open the new Evidence Contract and show that
   `target.class` moves to `E2` (runtime characterization): a real model decision is now
   observed, though independence stays `I0` and Reference's gate enforcement is still E3 for
   the gate itself, not for the model. This is the moment that actually evidences model
   behavior — say so explicitly.
5. If you want the single-profile failing path in isolation, select **Baseline** and use **Run
   Selected Profile** instead of the comparison button. Baseline permits the simulated action;
   Reference denies the same intent at the deterministic gate.
6. In recent runs, show the browser hash-chain status. Explain that it detects retained-window
   gaps but is not an external append-only log.

The important comparison is not "the model was good" versus "the model was bad." It is the
same malicious path under different control postures, with the gate decision visible — first
proven on a scripted path, then repeated against a real model to show it isn't just theater.

## 4:00–5:45 — Second case: MCP supply-chain compromise

1. Select **Poisoned MCP tool descriptor**.
2. Run **Baseline**, then **Reference** (Sample Replay is sufficient here; repeat the live-target
   pivot from step 4 above if time allows).
3. Show the descriptor provenance, server identity, sanctioned-server decision, and the
   resulting allow or deny event.

Be precise: this models descriptor and server provenance, descriptor drift, sanctioned-server
policy, and tool authorization. It is not a real MCP server penetration test or proof of
production containment.

## 5:45–6:30 — Approval integrity

Select the approval case and briefly show a variant. The approval is a structured record bound
to the exact tool-call fingerprint, current context, disclosed risk, and prior denial state.
Legacy `approvalGranted: true` is rejected because an unbound boolean cannot prove who approved
what. Replay and stripped-context variants become executable tests rather than labels.

## 6:30–7:00 — Close with limitations

Use **Repeat Trials** when demonstrating a live or local model. The aggregate reports rates and
configuration drift; it does not erase stochasticity or make this an independent evaluation.

If hardware permits, enable the **Secondary local-model judge** before a run. Show its blinded
judged verdict and agreement/disagreement separately from the deterministic verdict. Emphasize
that this is an I0 secondary opinion; it is useful triangulation, not outside validation.

State the remaining gaps plainly:

- the controls and default oracle are self-authored (I0);
- localStorage and exports are mutable, not signed or replay-resistant;
- tool effects are mocks, not production integrations;
- delegated identity, persistent memory, multi-agent propagation, and isolation testing remain
  future work.

Close on the evidence chain: enterprise task → untrusted content → malicious goal adoption →
attempted tool action → harness decision → retained evidence → honest limitation.
