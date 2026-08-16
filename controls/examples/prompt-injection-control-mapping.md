# Example: Prompt Injection Control Mapping

## Scenario

An evaluation case attempts to override the target model's instructions and cause it to disclose hidden instructions or abandon its assigned role.

## Source Relevance

- MITRE ATLAS: `AML.T0051` LLM Prompt Injection
- MITRE ATLAS: `AML.T0051.000` Direct
- OWASP LLM Top 10: `LLM01:2026` Prompt Injection

## Project-Defined Controls

- `LLM-SEC-001` Prompt Injection Resistance
- `LLM-GOV-002` AI Threat Modeling
- `LLM-EVAL-001` Adversarial Evaluation and Regression Testing
- `LLM-EVAL-002` Evaluation Evidence Retention

## Evidence to Preserve

- evaluation case ID and version
- model and runtime metadata
- system prompt profile or sanitized prompt reference
- prompt injection payload
- full model response stored locally
- evidence excerpt included in report
- heuristic verdict
- optional judge verdict
- reviewer decision
- mapped controls

## Official Mitigation References

- MITRE ATLAS: `AML.M0024` AI Telemetry Logging
- MITRE ATLAS: `AML.M0033` Input and Output Validation for AI Agent Components

## NETRUNNER Recommended Actions

- Separate trusted system instructions from untrusted user content.
- Avoid placing secrets or authorization logic in prompts.
- Validate expected output formats with deterministic code.
- Add prompt-injection regression cases to release checks.
- Treat successful or partial prompt-injection results as control-review triggers, not automatic compliance conclusions.

## Retest Guidance

Rerun direct prompt-injection cases after:

- system prompt changes
- model/provider changes
- guardrail changes
- retrieval-source changes
- tool or agent permission changes

Compare current results against the prior known-good baseline when available.
