# Source Ledger

This ledger records the sources used for Sleeper mappings and control-language decisions.
It is a traceability aid, not a legal or audit conclusion.

See [`../ATTRIBUTION.md`](../ATTRIBUTION.md) for concise third-party attribution and license/source notes.

## Mapping Types

- **Official source:** language or taxonomy maintained by the named organization.
- **Direct mapping:** the source explicitly connects the concept or taxonomy item.
- **Inferred mapping:** the lab maps source concepts to project-defined controls based on functional relevance.
- **Project-defined control:** control language created for this lab and intended to be replaced by organization-specific controls later.
- **Implementation guidance:** practical security or assurance language derived from multiple sources and local design decisions.

## Sources Reviewed

| Source ID | Source | Repo / File | Used For | Mapping Type | Date Reviewed |
|---|---|---|---|---|---|
| MITRE-ATLAS-DATA | MITRE ATLAS data repository | `mitre-atlas/atlas-data`, `dist/v6/ATLAS-2026.07.yaml` (content v2026.07, format-version 6.0.0) | Technique IDs, names, descriptions, variants, tactic context, and mitigation IDs/names | Official source / direct mapping | 2026-08-16 |
| OWASP-LLM-2026 | OWASP Top 10 for LLM Applications 2026 | `GenAI-Security-Project/GenAI-LLM-Top10`, `2026/final/*.md`, commit `7bbe0f06f468cdcc61fa73e1752183c6cfd23987` | LLM risk categories, prevention language, and scenario context | Official source / direct and inferred mapping | 2026-08-16 |
| OWASP-LLM-2026-APPENDIX-A | OWASP Top 10 for LLM Applications 2026, Appendix A — Related Framework Mappings | `GenAI-Security-Project/GenAI-LLM-Top10`, `2026/final/Appendix_A_Related_Framework_Mappings.md` | Published LLM→ASI, LLM→ATLAS tactic, and LLM→NIST AI RMF category relationships | Official source / **direct mapping** | 2026-08-16 |
| OWASP-ASI-2026 | OWASP Top 10 for Agentic Applications 2026 (v2026, December 2025) | `genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/` (PDF, "Agentic Top 10 At A Glance" p.8; Appendix A p.39) | ASI01–ASI10 IDs and titles; ASI→LLM Top 10 and ASI→T1–T17 relationships for the agent threats module | Official source / direct mapping | 2026-08-16 |
| AIUC-1-2026-07 | AIUC-1 standard, 2026-07-15 release | `aiunderwriting/AIUC-1-Changelog`, `standard/requirements.md`, `standard/controls.md`, commit `July 15 requirements and controls` | Requirement and control IDs and requirement names for the agent threats module | Official source / direct mapping | 2026-08-16 |
| ISO-42001-OFFICIAL | ISO/IEC 42001:2023 source page | `https://www.iso.org/standard/42001` | AIMS purpose, applicability, and management-system context | Official source / high-level context | 2026-06-15 |
| ISO-42001-SECTION9-WORKING | User-provided ISO 42001 mapping notes | `sunilp/ai-governance-framework`, `framework/compliance/iso-42001-mapping.md` | Section 9 labels for monitoring/measurement, internal audit, and management review | Third-party implementation guide / inferred mapping | 2026-06-15 |
| EU-AI-ACT-2024 | Regulation (EU) 2024/1689 | `https://eur-lex.europa.eu/eli/reg/2024/1689/oj` | High-risk readiness references for risk management, logging, oversight, robustness/cybersecurity, QMS, post-market monitoring, and critical infrastructure scope | Official source / relevance mapping | 2026-06-15 |
| SLEEPER-CONTROLS | Sleeper project-defined SaaS LLM control set | `controls/llm-saas-control-set.yaml` | Control objectives, evidence examples, test methods, retest guidance | Project-defined control | 2026-06-14 |

## MITRE ATLAS Technique References

All paths below are `dist/v6/ATLAS-2026.07.yaml` in `mitre-atlas/atlas-data`.

| Technique | Name | Lab Use |
|---|---|---|
| `AML.T0051` | LLM Prompt Injection | Parent technique for direct, indirect, and triggered prompt injection testing |
| `AML.T0051.000` | Direct | Direct user-supplied prompt injection relevance |
| `AML.T0051.001` | Indirect | External-content and RAG prompt injection relevance |
| `AML.T0051.002` | Triggered | User-action or event-triggered prompt injection relevance |
| `AML.T0054` | LLM Jailbreak | Jailbreak / guardrail bypass testing relevance |
| `AML.T0056` | Extract LLM System Prompt | System prompt extraction and hidden-context exposure testing relevance |
| `AML.T0057` | LLM Data Leakage | Sensitive disclosure and output monitoring relevance |

### Agent-layer techniques (agent threats module)

Registered by ATLAS alongside the AI-agent technique set. Referenced by the
agent threats module; the single-turn probe library does not exercise them.

| Technique | Name | Lab Use |
|---|---|---|
| `AML.T0053` | AI Agent Tool Invocation | Tool-call intent and authorization boundary relevance |
| `AML.T0084` | Discover AI Agent Configuration | Agent configuration disclosure relevance |
| `AML.T0084.001` | Tool Definitions | Tool-schema disclosure relevance; pairs with `LLM08:2026` Hidden Context Exposure |
| `AML.T0086` | Exfiltration via AI Agent Tool Invocation | Data egress through an authorized tool relevance |
| `AML.T0098` | AI Agent Tool Credential Harvesting | Credential exposure through connected tools relevance |
| `AML.T0101` | Data Destruction via AI Agent Tool Invocation | Irreversible-action and approval-gating relevance |
| `AML.T0110` | AI Agent Tool Poisoning | Malicious or tampered tool interface relevance |
| `AML.T0110.000` | Definition and Instructions | Tool-description/MCP descriptor poisoning relevance |
| `AML.T0110.001` | Implementation | Poisoned tool implementation relevance |
| `AML.T0110.002` | Runtime Response | Poisoned tool-result relevance |
| `AML.T0115.002` | Publish Poisoned AI Artifacts: AI Agent Tools | Malicious published tool / registry relevance |
| `AML.T0010.005` | AI Supply Chain Compromise: AI Agent Tool | Source-provenance / malicious-server relevance (case 3b) |
| `AML.T0011.002` | User Execution: Poisoned AI Agent Tool | Poisoned-tool execution relevance (case 3b); ATLAS's own description cross-references `AML.T0010.005` as the supply-chain path by which the tool was introduced |

Verified 2026-08-17 against `dist/v6/ATLAS-2026.07.yaml` (the current `ATLAS-latest.yaml`
target; no `2026.08` dist exists yet).

## MITRE ATLAS Mitigation References

| Mitigation | Name | Source Path | Lab Use |
|---|---|---|---|
| `AML.M0019` | Control Access to AI Models and Data in Production | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for production access-control relevance |
| `AML.M0020` | Generative AI Guardrails | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for guardrail relevance |
| `AML.M0021` | Generative AI Guidelines | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for model guideline relevance |
| `AML.M0022` | Generative AI Model Alignment | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for model alignment relevance |
| `AML.M0024` | AI Telemetry Logging | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for telemetry and monitoring relevance |
| `AML.M0026` | Privileged AI Agent Permissions Configuration | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for agent privilege scoping relevance |
| `AML.M0027` | Single-User AI Agent Permissions Configuration | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for per-user agent scoping relevance |
| `AML.M0028` | AI Agent Tools Permissions Configuration | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for tool least-privilege relevance |
| `AML.M0029` | Human In-the-Loop for AI Agent Actions | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for approval-gating relevance |
| `AML.M0030` | Restrict AI Agent Tool Invocation on Untrusted Data | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for untrusted-content tool gating relevance |
| `AML.M0032` | Segmentation of AI Agent Components | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for agent component isolation relevance |
| `AML.M0033` | Input and Output Validation for AI Agent Components | `dist/v6/ATLAS-2026.07.yaml` | Official mitigation reference for validation and sanitization relevance |

`AML.M0031` (Memory Hardening) sits numerically inside this range and is registered, but is
**not cited by any case in this module** — it covers persistent agent memory/state integrity,
which is the ASI06 memory-poisoning surface the agent module's threat-case scope explicitly
defers (`docs/agent-module-plan.md` §"Threat cases"). Recorded here so its absence from the
technique/mitigation tables above reads as a scope decision, not a missed registration.
Verified 2026-08-17 against `dist/v6/ATLAS-2026.07.yaml`.

## OWASP LLM Top 10 References

Source paths are `2026/final/` in `GenAI-Security-Project/GenAI-LLM-Top10`.

| Category | Name | Source Path | Lab Use |
|---|---|---|---|
| `LLM01:2026` | Prompt Injection | `LLM01_PromptInjection.md` | Prompt injection, jailbreak, direct/indirect injection, adversarial testing |
| `LLM02:2026` | Sensitive Information Disclosure | `LLM02_SensitiveInformationDisclosure.md` | Sensitive data handling, leakage prevention, prompt/context/log review |
| `LLM03:2026` | Excessive Agency | `LLM03_ExcessiveAgency.md` | Tool authorization, least privilege, human approval, complete mediation |
| `LLM04:2026` | Supply Chain | `LLM04_SupplyChain.md` | Model/tool provenance and third-party dependency relevance |
| `LLM08:2026` | Hidden Context Exposure | `LLM08_HiddenContextExposure.md` | System prompt, developer instruction, retrieved policy text, and tool-schema exposure |
| `LLM09:2026` | Vector and Embedding Weaknesses | `LLM09_VectorAndEmbeddingWeaknesses.md` | RAG trust boundaries, retrieval access control, source validation |

### 2025 → 2026 edition changes

The 2026 edition renumbered eight of ten entries.

| 2025 | 2026 | Note |
|---|---|---|
| `LLM06:2025` Excessive Agency | `LLM03:2026` Excessive Agency | Promoted from sixth to third |
| `LLM07:2025` System Prompt Leakage | `LLM08:2026` Hidden Context Exposure | Renamed and broadened to cover any non-user-facing context, explicitly including tool schemas |
| `LLM08:2025` Vector and Embedding Weaknesses | `LLM09:2026` | Renumbered |
| `LLM03:2025` Supply Chain | `LLM04:2026` | Renumbered |

Note on cross-references: the OWASP Top 10 for Agentic Applications (December
2025) predates the 2026 LLM edition, so its own text cites 2025 LLM IDs. When
quoting ASI cross-references, preserve the 2025 ID as published and add the
2026 equivalent alongside rather than silently rewriting it.

## OWASP Top 10 for Agentic Applications (ASI) References

Used by the agent threats module. See [`agent-module-plan.md`](./agent-module-plan.md).

| Category | Name | Lab Use |
|---|---|---|
| `ASI01` | Agent Goal Hijack | Indirect injection redirecting agent goals and multi-step behavior |
| `ASI02` | Tool Misuse and Exploitation | Legitimate tools applied unsafely within granted privilege; runtime tool-descriptor poisoning |
| `ASI03` | Identity and Privilege Abuse | Un-scoped privilege inheritance and delegation-chain abuse |
| `ASI04` | Agentic Supply Chain Vulnerabilities | Malicious or compromised tools, MCP servers, and registries at the source |
| `ASI09` | Human-Agent Trust Exploitation | Approval-gate bypass, missing confirmation, and over-reliance on agent rationale |

Scope boundary published by OWASP and preserved here: manipulating the
interface of an otherwise legitimate tool **at runtime** (MCP tool descriptors,
schemas, metadata, routing) is `ASI02`. Only cases where the tool itself is
malicious or compromised **at the source** are `ASI04`.

## AIUC-1 References

Requirement and control IDs from the 2026-07-15 release. AIUC-1 revises
quarterly; every citation carries the release date it was read from.

| Requirement | Name | Lab Use |
|---|---|---|
| `A003` | Limit AI agent data access | Task-scoped agent data access relevance |
| `B002` | Detect adversarial input | Prompt-injection detection and alerting relevance |
| `B005` | Implement real-time input filtering | Pre-model input filtering relevance |
| `B006` | Prevent unauthorized AI agent actions | Agent action scope, approved MCP servers, pre-execution authorization hooks |
| `B008` | Protect AI system deployment environment | MCP connection authentication and tool I/O schema validation relevance |
| `C007` | Flag high risk outputs for human review | Human-review routing relevance |
| `D003` | Restrict unsafe tool calls | Tool-call validation, approval workflows, execution logging |
| `D004` | Third-party testing of tool calls | Independent tool-call assessment relevance |
| `E006` | Conduct vendor due diligence | Third-party MCP server and tool vendor relevance |
| `E009` | Monitor third-party access | Third-party connection logging and anomaly alerting relevance |
| `E015` | Log AI system activity | Agentic execution-chain evidence: tool call parameters and results, delegations, approval events |

## Project-Defined Mapping Notes

- The Sleeper controls are **not** MITRE, OWASP, NIST, ISO, CSA, or EU AI Act controls.
- MITRE and OWASP entries are used as source-grounded risk and technique references.
- Mappings from MITRE/OWASP entries to `LLM-*` controls are project-defined and should be treated as inferred unless a future source explicitly defines the relationship.
- **One exception, added 2026-08-16:** the OWASP Top 10 for LLM Applications 2026 publishes Appendix A, *Related Framework Mappings*, which directly asserts LLM→ASI, LLM→ATLAS tactic, and LLM→NIST AI RMF category relationships. Those are recorded in `OWASP_PUBLISHED_CROSSWALK` (`src/data/frameworkMappings.js`) and are **direct**, not inferred. Everything else in that file remains project-defined. OWASP's NIST AI RMF mapping is at Category level (e.g. `MEASURE 2`, `MAP 4`); Sleeper's existing RMF references are at Function level (Govern/Map/Measure/Manage) and remain inferred.
- Framework source versions asserted by the app are pinned in `FRAMEWORK_VERSIONS` (`src/data/frameworkMappings.js`). Update that constant and this ledger together.
- AIUC-1 requirement and control IDs and short requirement names are cited directly. Control language is paraphrased, not reproduced: the `aiunderwriting/AIUC-1-Changelog` repository publishes no license.
- MITRE ATLAS mitigation references preserve official mitigation IDs and names. Sleeper recommended actions and retest guidance are project-defined implementation guidance.
- ISO/IEC 42001, NIST AI RMF, and EU AI Act references in the app are relevance indicators only. They are not compliance determinations.
- ISO/IEC 42001 section 9 references are used to frame performance-evaluation evidence: monitoring and measurement, internal audit, and management review.
- EU AI Act references use a SaaS / critical digital infrastructure readiness lens for CDN, edge, cybersecurity, cloud, and critical digital infrastructure SaaS providers. High-risk status depends on actual system role, intended purpose, jurisdiction, and whether the AI system is used as a safety component or falls into another high-risk category.
- Cybersecurity-only components are not automatically treated as EU AI Act safety components.
- Delimiter-confusion cases are project-defined local variants. They are recorded under the official direct prompt-injection sub-technique, with `source_status: local-variant`, and are not represented as separate MITRE ATLAS technique IDs.

## Review Checklist

Before publishing a report or demo:

- Confirm source dates are current enough for the purpose.
- Separate directly sourced taxonomy language from project-defined control language.
- Avoid legal, audit, certification, or regulatory conclusions.
- Keep sensitive evidence minimized and sanitized.
- Label local/custom variants clearly.
