# SLEEPER LLM SaaS Control Set

This directory contains a starter, project-defined control set for SLEEPER.
It is intended to show how adversarial LLM evaluation results can map to SaaS-ready security and assurance controls.

The controls are **not** an official framework. They are deliberately replaceable. When organization-specific AI controls are available, they should supersede this draft.

## Files

- `llm-saas-control-set.yaml` - draft control catalog with objectives, evidence examples, test methods, and retest guidance.
- `control-mapping-matrix.md` - traceability matrix connecting controls to MITRE ATLAS, OWASP LLM Top 10, ISO/IEC 42001 section 9, and EU AI Act readiness references.
- `example-mapping.json` - lightweight machine-readable example from the initial MVP.
- `examples/` - worked examples for prompt injection, system prompt leakage, and indirect prompt injection/RAG.
- `../docs/source-ledger.md` - source ledger documenting what is official, inferred, and project-defined.

## Control Families

- `LLM-GOV-*` - governance, inventory, and threat modeling
- `LLM-SEC-*` - LLM application security controls
- `LLM-EVAL-*` - adversarial evaluation and evidence retention
- `LLM-MON-*` - monitoring and detection
- `LLM-OPS-*` - incident response
- `LLM-TPRM-*` - vendor and model provider risk

## Example Traceability Path

```text
Evaluation case DI-001
-> MITRE ATLAS AML.T0051 / AML.T0051.000
-> OWASP LLM01:2026 Prompt Injection
-> LLM-SEC-001 Prompt Injection Resistance
-> LLM-EVAL-001 Adversarial Evaluation and Regression Testing
-> finding evidence and retest guidance
```

## Language Boundaries

Use:

- framework relevance
- control traceability
- potential control weakness
- evidence supporting control review
- retest guidance

Avoid:

- legal violation
- audit failure
- certification failure
- regulatory noncompliance

The lab can produce evidence that a control should be reviewed or retested. It should not claim that a single model response proves a compliance outcome.
