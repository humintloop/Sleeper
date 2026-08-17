# NETRUNNER — scope and priorities (from the 2026-08-17 scoping conversation)

This doc exists so the reasoning behind what's in/out of scope survives past the conversation
that produced it. If you're Claude Code picking this up: read this before docs/coherence-review.md
so the findings there are weighted correctly — some of what's flagged "medium" there is actually
high-priority once you know the thesis, and vice versa.

## The claim (this is what everything else is judged against)

Model-level safeguards are not sufficient to prevent an agent from taking a malicious or
unintended action. The harness and process controls *around* the model are what actually
constrain it. Evidence of that — what the agent tried, what stopped it, what didn't — has to be
retained and reviewable. NETRUNNER exists to demonstrate that claim concretely, not to be sold or
deployed.

## What this actually is

- Not a product pitch. Not being sold. No one is the "customer."
- A portfolio / conversation / teaching piece — evidence that the author understands the agentic
  AI threat landscape at a technical level, aimed partly at AI governance / GRC people who
  understand policy but not the technical mechanics underneath it.
- Primary audience: AI governance folks who want to trace attack → control → audit/framework
  mapping. Secondary audience: technical peers.
- Not necessarily a live stage presentation — likely encountered by someone viewing it on their
  own (repo, running app, exported report), possibly shown 1:1 at Offensive AI Con rather than
  presented as a talk. Confirm before assuming "must survive a live demo" is a real constraint.
- Explicit limitation to state up front, not bury in a footer: **this is not real-world-usable
  technology.** It's a demo that uses real tool-call intent and real agent decision-making
  against mock effects, as a teaching example.

## Keep, and raise in priority

- **The agent-case flow is the product now.** ReAct loop, control-profile comparative arm,
  verdict, Evidence Contract. Everything else is secondary.
- **Evidence persistence.** Agent-case runs currently live in component state only and vanish on
  navigation (coherence-review.md U6/U14). This directly contradicts the "evidence must be
  retained" claim — fix before anything else UI-related. Wire agent-case results into the
  findings/storage system.
- **Evidence Contract panel and framework crosswalk panel legibility** (U5, U8). This is the
  actual bridge to the primary audience. `EvidenceContractPanel.jsx` needs a plain-language
  legend for E1-E5/I0-I2, not a raw JSON blob. `FrameworkCrosswalkPanel.jsx`'s
  `{JSON.stringify(row)}` needs to render as an actual table.
- **L1 (PII guard only scans final chat text, not tool-call arguments)** — fix. It's a blind spot
  in case 1 specifically, the case that best demonstrates the claim.
- **L2 (`requestServiced: false` can mask an observed PII exposure)** — fix. Same reasoning:
  the claim is "evidence must survive," this is a code path where it currently doesn't.
- **The bug-hunting narrative itself** (two more ORPHEUS-shape defects found, mutation-tested the
  regression suite by splicing the old logic back in and confirming 19 tests fail, the
  INCONCLUSIVE discipline) — this is portfolio-grade material demonstrating exactly the
  understanding Q7 is going for. Surface it somewhere a viewer will actually see it (README or a
  short methodology write-up), not just in the plan doc.

## Cut or demote

- **Single-turn probe flow** as a primary, co-equal entry point. Confirmed: agents are the focus.
  Doesn't need to be deleted (it's mature, tested, low cost to leave working) but should not
  compete for attention on the home screen. This also resolves U2/U3/U4 for free — the "two
  flows, unexplained, colliding vocabularies" problem mostly disappears if there's only one
  flow being shown by default.
- **Branding/wordmark consistency (U1)** and the visual-direction work — still worth doing, but
  not urgent. Nothing catastrophic happens if "SLEEPER" lingers a bit longer, since this isn't
  being pitched to anyone on a deadline-critical stage moment. Fix for self-respect, not risk
  management.
- **`Header.jsx` dead code (U11)** — trivial, delete whenever.

## Open, unresolved — don't guess on these

1. **Do all four threat cases need real depth**, or does one or two done completely (fixture →
   run → verdict → Evidence Contract → framework crosswalk, no gaps) serve the AI-gov audience
   better than four cases at uneven finish? The plan doc's own risk section already called
   "three cases at equal depth in seven weeks" the aggressive option — this predates the
   audience clarification above and is worth revisiting now that the audience is confirmed.
2. **Is Offensive AI Con still a real venue** (shown 1:1 on a laptop at the retreat) or was it a
   deadline-forcing device? Determines whether "survives being clicked through live in front of
   someone" is a real constraint on the UX work or not.
