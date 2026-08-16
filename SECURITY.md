# Security Policy

## Supported Project Scope

NETRUNNER is a local-first LLM assurance and security research tool. Security reports for this repository should focus on vulnerabilities in the tool itself, its published site, or its project artifacts.

Examples that are in scope:

- Cross-site scripting or unsafe rendering in the NETRUNNER web app
- Dependency vulnerabilities with a realistic impact path
- Evidence export behavior that exposes data beyond the local browser session
- Build, packaging, or deployment issues that could affect users of the project
- Documentation that could materially mislead users about safe or authorized use

Examples that are out of scope:

- Reports that a local model can be jailbroken using the included evaluation cases
- Findings against third-party LLM services, vendors, or production systems not owned by this project
- Social engineering, phishing, spam, or denial-of-service testing
- Automated high-volume scanning of the GitHub Pages site

## Responsible Disclosure

Please report suspected vulnerabilities privately before public disclosure.

Preferred contact:

- Open a private security advisory on GitHub for this repository.

If GitHub private advisories are unavailable, open a minimal public issue that says you have a security report and avoids exploit details. A maintainer will coordinate a private channel.

## What To Include

Helpful reports include:

- A clear description of the issue
- Steps to reproduce
- Affected files, routes, or versions
- Expected vs. observed behavior
- Impact and realistic exploitation conditions
- Suggested remediation, if known

## Response Expectations

This is an early-stage project, so response times may vary. The goal is to acknowledge valid reports within a reasonable timeframe, investigate reproducible issues, and credit reporters when appropriate.

## Safe Research Expectations

Do not test NETRUNNER or any LLM-enabled system without authorization. Do not use this project to attack production systems, bypass access controls, extract data from systems you do not own, or publish active exploit material without permission.

Framework mappings and evaluation outputs are evidence indicators only. They do not establish legal, audit, certification, or regulatory conclusions.


## Local Assessment Data Handling

NETRUNNER is local-first, but local data can still be sensitive. The active target system prompt is held in memory and is not persisted to localStorage by default. NETRUNNER-owned localStorage keys store active-case metadata, locally saved findings, and analyst metadata. The app includes a **CLEAR LOCAL ASSESSMENT DATA** control that removes those NETRUNNER-owned keys without calling `localStorage.clear()`.

Evidence exports may include full model responses, attack payloads, evaluator rationale, reviewer notes, model/runtime metadata, control mappings, and other assessment metadata. Newly created findings and exports use the target prompt hash where prompt context is needed and do not include plaintext target prompt previews. Exports are not immutable, tamper-proof, or cryptographically signed.


## Content Security Policy Note

A stricter CSP should be added only after validating WebLLM model downloads, module workers, WASM execution, Google Fonts, GitHub Pages hosting, and the cross-origin isolation service worker together. A candidate policy will likely need allowances for `script-src`/`worker-src` module workers and WebLLM runtime assets, `connect-src` model artifact origins, `font-src` Google font assets unless self-hosted, and the existing COOP/COEP service-worker path. This pass intentionally does not add a CSP because an under-tested policy could break browser-local inference or cross-origin isolation.
