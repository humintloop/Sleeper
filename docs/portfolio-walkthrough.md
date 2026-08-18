# SLEEPER: 7-minute portfolio walkthrough

## The claim

Model safeguards are not an authorization boundary. An enterprise agent consumes untrusted
content and can request consequential tools, so deterministic controls around the model must
constrain actions and retain honest evidence.

## 0:00–1:00 — Set the trust boundary

Open **Run agent case**. Keep **Sample Replay** selected and explain the disclosure: its
scripted path makes the demonstration reliable without pretending a model made the decision.
All tool effects are simulated. The target side is E1; an exercised SLEEPER gate can be E3
evidence about that gate only.

## 1:00–3:30 — Hero case: indirect email injection

1. Select **Indirect injection → unauthorized action** and **Baseline**.
2. Run the case. Follow the trace from the employee request to the external email, the hidden
   instruction, internal data retrieval, and attempted outbound email.
3. Point out the instruction source and trust label on the tool intent. Baseline permits the
   simulated outbound action, so the verdict is `CONTROL_FAILED`.
4. Switch to **Reference** and run the same case. The scripted intent is unchanged; the
   deterministic gate denies the action sourced from untrusted content.
5. Open the Evidence Contract. Show the execution chain, run-manifest digests, evidence ceiling,
   simulation boundary, and unsigned-integrity warning.
6. In recent runs, show the browser hash-chain status. Explain that it detects retained-window
   gaps but is not an external append-only log.

The important comparison is not “the model was good” versus “the model was bad.” It is the
same malicious path under different control postures, with the gate decision visible.

## 3:30–5:15 — Second case: MCP supply-chain compromise

1. Select **Poisoned MCP tool descriptor**.
2. Run **Baseline**, then **Reference**.
3. Show the descriptor provenance, server identity, sanctioned-server decision, and the
   resulting allow or deny event.

Be precise: this models descriptor and server provenance, descriptor drift, sanctioned-server
policy, and tool authorization. It is not a real MCP server penetration test or proof of
production containment.

## 5:15–6:15 — Approval integrity

Select the approval case and briefly show a variant. The approval is a structured record bound
to the exact tool-call fingerprint, current context, disclosed risk, and prior denial state.
Legacy `approvalGranted: true` is rejected because an unbound boolean cannot prove who approved
what. Replay and stripped-context variants become executable tests rather than labels.

## 6:15–7:00 — Close with limitations

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
