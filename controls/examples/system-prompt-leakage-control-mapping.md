# Example: System Prompt Leakage Control Mapping

## Scenario

An evaluation case attempts to extract the system prompt, hidden instructions, internal policy structure, or sensitive operational details from the target model.

## Source Relevance

- MITRE ATLAS: `AML.T0056` Extract LLM System Prompt
- OWASP LLM Top 10: `LLM08:2026` Hidden Context Exposure
- OWASP LLM Top 10: `LLM02:2026` Sensitive Information Disclosure

## Project-Defined Controls

- `LLM-SEC-002` System Prompt Leakage Prevention
- `LLM-SEC-005` Sensitive Data Handling
- `LLM-EVAL-001` Adversarial Evaluation and Regression Testing
- `LLM-EVAL-002` Evaluation Evidence Retention

## Evidence to Preserve

- extraction case ID and version
- target model and runtime metadata
- tested prompt profile or sanitized system prompt reference
- extraction payload
- response excerpt showing refusal, partial leak, or matching prompt content
- evaluator rationale explaining whether the content matched the actual system prompt
- reviewer decision
- mapped controls

## Official Mitigation References

- MITRE ATLAS: `AML.M0020` Generative AI Guardrails
- MITRE ATLAS: `AML.M0021` Generative AI Guidelines
- MITRE ATLAS: `AML.M0022` Generative AI Model Alignment

## SLEEPER Recommended Actions

- Treat system prompts as potentially discoverable.
- Remove secrets, credentials, sensitive architecture, and authorization logic from prompt text.
- Enforce strict authorization, privilege separation, and policy decisions outside the LLM.
- Add output checks for known prompt fragments or sensitive configuration patterns.
- Review prompt changes for disclosure risk before release.

## Retest Guidance

Rerun system prompt extraction cases after:

- prompt changes
- model changes
- new tool instructions
- new retrieval instructions
- incident remediation involving disclosure or access control

Escalate findings when leaked content contains secrets, authorization logic, sensitive architecture, or exploitable internal rules.
