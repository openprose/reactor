# OpenProse Reactor Harness

###### A Reactor-class harness for evented reconciliation of AI-maintained world state.

The OpenProse corpus divides labor exactly, and each document maps to what
ships:

- [01-Language.md](./01-Language.md) — **the Language & Framework**, bundled as
  the **SKILL**: syntax, kinds, sections, compile model, std/co, CLI surface.
- [02-ReactorHarness.md](./02-ReactorHarness.md) — **this
  document, the Reactor Harness**, bundled as the **CLI/Server**: the runtime
  control architecture — the loop, invariants, kernel, memoization, forecast,
  receipts, composition. It names the architectural class underneath
  continuous outcomes and answers _what the runtime must do_.
- [03-ReactorPattern.md](./03-ReactorPattern.md) — **the
  Reactor-Native Authoring Pattern**, **SKILL-bundled but harness-governed**:
  how to write `*.prose.md` so this harness's mechanisms engage. It bridges
  the Language doc and this doc.
- [ReactorFeedback.md](../history/ReactorFeedback.md) — **the
  decision log**, not shipped: the dialectic that produced this revision. This
  document is the clean statement and does not carry the dialectic.
- [00-Tenets.md](./00-Tenets.md) — **the constitution**. When any
  document tensions with a tenet, the tenet wins.

`ContinuousOutcomes.md` is out-of-scope ideation, not part of the runtime spec.

This file has three parts:

1. The ideal Reactor-class harness.
2. What exists today, assuming the responsibility CLI harness branch is merged
   and released.
3. What is next before OpenProse should publicly launch the term with a
   technical report.

---

## I. Ideal Reactor-Class Harness

### What it is like to use one

Start from the lived loop, not the machinery. The architecture is the
consequence of this promise, not the thing itself.

> You write one sentence of durable intent and what makes it true. Then you
> walk away — there is no session to babysit. The system interrupts you on
> exactly two conditions: it needs a judgment only a human can make, or an
> input or permission only you can grant. Otherwise it is silent. Everything it
> did, you can verify afterward from a trail you never had to ask for — and you
> can take that trail and that sentence and run them somewhere else.

Four beats: **author**, **walk away**, **interrupted only when genuinely
needed**, **verifiable and exitable trail**.

One honesty note belongs in the promise itself: interruptions **front-load
during authoring and asymptote toward silence**. "Walk away" is the steady
state, not the first hour. Saying so is what makes the rest credible — a
contract is at its most ambiguous the moment it is written, and the system's
most valuable early output is often "this sentence is not yet decidable, here
is why."

Everything below is the answer to a single question asked of each beat: _what
does this beat require the runtime to do?_

### The responsibility

A responsibility is a standing goal, written as durable intent. It is not a
task, script, or single run. It is a statement that should remain true:

```text
The release candidate is ready to ship.
Important customer risks are surfaced before renewal meetings.
The incident channel has a current, accurate briefing.
Compliance evidence is fresh enough for the next audit.
```

The contract is authored in `*.prose.md` per `00-Tenets.md` Tenet 1.
Nothing else carries semantic weight; compiled IR, projections, and read models
are derived views.

### The canonical loop

Each event is a reason to reconcile the modeled world state. An event may be a
timer tick, webhook, queue message, file change, source change, manual request,
judge drift, fulfillment completion, or retry outcome.

```text
event
  -> bounded judge or fulfillment activation
  -> durable status and evidence
  -> Reactor decision
  -> projected state
  -> scheduled judge, fulfillment, retry, escalation, or quiescence
```

The harness is "Reactor-class" when the policy for that loop is explicit,
typed, replayable, and shared across hosts. The model judges and fulfills
inside bounded activations; continuity lives in durable state, never in a
long-running session.

The distinction from a normal agent loop is the whole point.

A normal agent loop asks:

```text
What should I do next?
```

A Reactor-class harness asks:

```text
Given this responsibility, this event, the latest observations, and the prior
decisions, what reconciliation action is now justified?
```

That turns agent behavior from a running conversation into an inspectable state
transition.

### The unification thesis

The loop above is the **base case**. The full architecture is one mechanism
applied recursively:

> **Model-authored policy, compiled to a token-free deterministic registry,
> executed with memoization, forecast-gated scheduling, and confidence-gated
> depth.**

This single mechanism, seen from different sides, is the whole of Part I.
Two recursions wrap the base case:

- **Policy over time.** The control policy itself — cadence, hysteresis band
  shapes, escalation thresholds — is _authored by the model_, then _compiled_
  into a deterministic, replayable, token-free artifact that runs hot for a
  window. The mechanism is **Popperian**: the compiled policy ships _its own
  falsification predicate_ — the conditions, stated at author time, under which
  it admits it is wrong (observed drift exceeds its predicted curve; escalation
  precision falls below its claimed threshold; cost per maintained
  responsibility trends past its stated budget). The deterministic kernel is a
  dumb evaluator of that predicate against the receipt log, plus a **tiny fixed
  backstop that does not trust the predicate to be honest** (max policy age,
  min recompile interval, max calibration divergence, and
  rollback-to-last-known-good — a fresh policy that trips its own predicate
  faster than its predecessor auto-reverts). No model call decides whether to
  recompile: the model only authored the tripwire; the kernel checks whether it
  fired. This is the existing OpenProse compile step made continuous. The model
  owns _intelligence_ (policy authorship); determinism owns only _execution_ of
  model-authored policy. Tenet 2 is honored, not violated: a dumb fast
  mechanism with intelligent slow parameters. The original "Reactor decides
  from typed state" is the special case where the policy is fixed. The
  meta-loop has its own hysteresis so it does not recompile too eagerly, and
  policy artifacts get the same receipts and replay that responsibilities get
  (open items I.2, I.4).

- **Responsibilities over a graph.** A signed, content-addressed receipt is
  already a perfect evidence token. "B depends on A" means B's judge consumes
  A's latest receipt as an evidence source, identical to consuming a webhook.
  **The dependency graph is the evidence graph.** The original
  single-responsibility loop is the N=1 case.

You do not need to re-understand the core loop. You need to understand that it
is the base case of these two recursions. Everything else is presentation.

### The two compiles

OpenProse compiles twice. The two share one *doctrine* but are not one
*operation*; conflating them silently breaks audit, replay, and adaptivity.

| | Source-compile | Policy-compile |
| --- | --- | --- |
| Fires when | the author changed intent | the world drifted from what the policy predicted (the falsification predicate tripped) |
| Input | `*.prose.md` source only | contract **+ accumulated receipt history** |
| Question | "what did the author declare?" | "given the declaration *and everything observed*, what is the cheapest correct way to maintain it?" |
| Output | repository IR (structural lowering) | the token-free policy registry the kernel executes |
| Lifetime | until source changes again | until the predicate trips or the backstop fires |
| Correctness test | fidelity to source (deterministic validation) | calibration against reality (the falsification predicate) |

They cannot be merged, for three independent reasons. **Audit/replay:** "the
verdict changed because the author rewrote the criteria" and "the cadence
changed because calibration degraded" are different histories that must replay
against different recorded artifacts (invariant 8, Tenet 5). **Lifetime:** IR
is valid until source changes (perhaps months); the policy artifact until the
predicate trips (perhaps hours); one artifact cannot carry two validity clocks.
**Determinism boundary:** source→IR is a fidelity problem the CLI checks
deterministically; contract+history→policy is optimization under uncertainty
with no single correct answer, checked by the falsification predicate.

The lifecycle asymmetry is the proof they are distinct:

```text
t0     author writes contract  → SOURCE-compile → IR
                                → POLICY-compile (cold start) → seed policy
t0–30  no source edits; IR byte-identical all month
t12    judge calibration degrades       → predicate trips → POLICY-compile  (IR untouched)
t19    cost-per-maintained over budget  → predicate trips → POLICY-compile  (IR untouched)
       —— 30 days: SOURCE-compile 0×, POLICY-compile 2× ——
t31    author sharpens a criterion → SOURCE-compile → new IR + revision
                                    → may cascade → POLICY-compile
```

Source-compile can cascade into policy-compile; policy-compile never causes
source-compile; policy-compile fires many times between source edits. Two
operations with different invocation counts over the same window are not one
operation. The mental model: source-compile is the **compiler** (source →
bytecode; changes only when source changes); policy-compile is the
**profile-guided / JIT optimizer** (re-optimizes from the observed runtime
profile when the workload drifts). Mapped exactly: IR = bytecode, the receipt
log = the runtime profile, the policy registry = JIT-optimized code, the
falsification predicate = the deopt guard. Same toolchain, different stages,
both essential. The unification is at the doctrine layer (the thesis above),
deliberately; the operations stay two — as `map` and `filter` share a pattern
but are never collapsed into one function.

**Safety line.** *Both* compiles emit a **static artifact consumed and
validated by deterministic code** — the language is never on the execution or
safety path. A model authors; code validates the artifact; the kernel executes
it; the fixed backstop catches a bad artifact regardless of how it was
authored. This is the same safe pattern the existing source compiler already
uses (model-run, CLI-validated), applied a second time.

**The policy author is an agent, and its representation is sequenced.** Policy
authoring is inherently agentic: it must explore the receipt history
dynamically, not consume a one-shot stuffed context. That agent-ness is
non-negotiable from day one. Its *launch representation*, however, lives behind
the static-artifact boundary and is deliberately sequenced so the
safety-critical bootstrap does not depend on an unproven self-referential
layer:

1. **v0.1** — agentic author launched via the proven agent-session adapter;
   dynamic receipt-history exploration; cold start is a contract-only prior
   (the static seed). Code owns trigger evaluation, artifact validation,
   backstop, and rollback; the agent owns exploration and authorship.
2. **v0.2** — the same agent, now recurring: the kernel's falsification
   predicate triggers recompile; rollback-to-last-known-good and calibration
   scoring are active. Still adapter-launched.
3. **v0.3+** — once the Prose VM is proven, migrate the launch representation
   to a first-class OpenProse `kind: responsibility` ("the control policy for
   X stays current and well-calibrated") fulfilled by an agentic
   `kind: system`. Artifact format, kernel, and backstop are unchanged, so the
   migration is no-throwaway — the recursion closing on itself, and the end
   state that most proves the thesis.

Invariants across all three steps: the author is a real exploratory agent from
day one; it emits a static artifact validated by code; the language is never
on the execution or safety path; the representation lives behind the artifact
boundary — the same agent-SDK-adapter seam ratified in *Architecture* below.

### Quiescence

The headline behavior, and the clearest proof of the thesis:

> A normal agent loop's cost scales with wall-clock time. A Reactor's cost
> scales with surprise — plus a forecast-amortized plan-audit floor
> calibration drives toward, but never to, zero (see *The plan-completeness
> audit*).

Quiescence is not the absence of behavior; it is three explicit behaviors,
ordered by how much they save:

1. **Don't act.** Status is `up`; no fulfillment. The trivial case.
2. **Don't check now.** Forecast says drift probability stays low until time
   _T_; the next judge is scheduled at _T_ and the runtime sleeps. Zero tokens
   between, except the forecast-paced plan-audit floor (see *The
   plan-completeness audit*): provable quiescence is zero tokens *between
   forecast-paced plan audits*, not zero tokens on a static world.
   (= don't re-render until a dependency changes.)
3. **Don't check deeply.** When a check is due, run the cheapest sufficient
   judge; escalate depth only on uncertainty or stakes. (= don't re-render the
   whole tree, only the subtree that changed.)

The rigorous core is **memoization**: a verdict is keyed by the hash of its
inputs (contract revision + evidence receipts + dependency receipts). Unchanged
hash → the verdict is reused at zero token cost — `React.memo` semantics applied
to judgment.

**The completeness law.** A hash is only safe if it captures every input that
could change the verdict — the classic cache-invalidation trap, whose failure
is silent (confident staleness). The law that makes the hash complete _by
construction_: **shallow judging executes a compiled, stable evidence plan** —
the set of sources to consult is a function of the contract revision, authored
by the model at policy-compile time, not improvised per cycle. Only **deep**
(escalated) judging may roam; roaming that discovers a new dependency forces a
policy recompile that adds it to the plan. The memo key is therefore complete
relative to the current compiled plan, and plan-incompleteness is surfaced
through the deep-escalation-and-recompile path, never silently ignored. This
also protects the cost thesis: a judge that re-roamed every cycle would keep
the memo key unstable on a static world, collapse the hit rate, and kill "cost
scales with surprise" while every correctness test still passed.

**The plan-completeness audit.** The completeness argument above has a known
gap: deep roaming is the only path that discovers a missing dependency, yet
deep is gated on shallow confidence, and a memo key built from an _incomplete_
plan is stable-by-omission — it manufactures confidence and suppresses the
escalation that would expose its own incompleteness. Confident staleness is
otherwise merely relocated from the verdict to the plan. The law therefore
requires a **second forecast clock, paced on plan age rather than evidence
age**, that injects a synthetic input forcing a **deep, roaming revalidation
whose trigger is independent of the shallow judge's confidence**. This is the
same synthetic-input mechanism that makes silence safe against the
missing-webhook problem, retargeted from "the world changed without an event"
to "the plan may be incomplete without an escalation." When the plan-age clock
crosses threshold the runtime escalates regardless of shallow confidence; the
roam either confirms the plan complete (resetting the clock, recording a
receipt whose `surprise_cause` is `forecast-recheck` with `recheck_kind:
plan-age`) or discovers a dependency and forces a policy recompile.
The clock is itself a model-authored, calibration-scored policy parameter (a
falsification-predicate input under _The two compiles_), not a fixed
heartbeat: domains with cheap stable identities and low semantic drift earn
long audit intervals; semantic-drift domains are paced tighter.

The safety watch-out: memoizing on a stale input hash means the system could
quiesce confidently while the world changed silently because no event fired
(the missing-webhook problem). The defense is forecast: time since the last
true check raises drift probability even with zero events, and crossing the
forecast threshold injects a **synthetic input change** that breaks the memo.
Forecast's real job is to manufacture the minimum necessary re-render when the
world will not announce that it changed. That is what makes silence _safe_
rather than _negligent_.

### Core invariants

These are the constitution. Each survives the negation test: negate it and the
result is no longer a Reactor-class harness. Items that fail that test (a
negation that still yields a Reactor-class harness, only a worse-designed one)
are design defaults and live in **Architecture**, not here.

1. **Markdown is intent.** The source contract is the durable semantic object.
   Negate it and intent lives in a hidden surface — Tenet 1 broken.
2. **Policy is model-authored, compiled, and shared.** Reactor decisions are
   produced by one compiled policy artifact, identical on every host. Negate it
   and two hosts interpret policy independently — forked semantics.
3. **Adapters are the only reason hosts differ.** A clone and a long-lived
   deployment diverge only because storage, sandbox, signer, or connector
   adapters differ. Negate it and the loop has forked — Tenet 1 broken.
4. **Activations are bounded.** No continuity depends on one long-running model
   session. Negate it and it is an agent loop, not a Reactor.
5. **Cost scales with surprise.** A normal agent loop's cost scales with
   wall-clock time; a Reactor's cost scales with surprise plus a
   forecast-amortized plan-audit floor. Stated as a
   falsifiable challenge: **for every token, name the surprise.** Negate it and
   the differentiator is gone. Four backing commitments make this testable:
   - **No fixed-interval work.** The Reactor core spends zero tokens between
     scheduled checks. Forecast _replaces_ polling — polling is "I don't know
     when"; forecast is "I computed when." Where a source cannot push, polling
     is pushed to a gateway adapter and is itself forecast-paced, never a
     heartbeat.
   - **Memoization is real.** Unchanged input hash → reused verdict, provably
     zero judge tokens, recoverable from the fresh-vs-reused token ratio in the
     receipt.
   - **Depth is variable and confidence-gated.** Cheapest sufficient judge by
     default; ensemble only on uncertainty or stakes.
   - **Every token traces to a surprise-cause** ∈ {real input change,
     forecast-manufactured recheck, escalation}. The plan-completeness audit
     is a forecast-manufactured recheck paced on plan age, not a fourth
     cause; its tokens are the forecast-amortized plan-audit floor, not a
     counterexample to the claim.
6. **The judge fails safe.** Given the judge's calibrated confidence,
   uncertainty escalates rather than acts; conflicting evidence lowers
   confidence rather than averaging it away. "Calibrated confidence" means
   confidence whose calibration is measured, not assumed; an unvalidated or
   degraded confidence signal forces escalate-by-default, never quiesce (see
   _Failure model_, degraded-calibration mode). An uncalibrated confidence
   signal (no authored or accrued anchor) forces escalate-by-default
   *indefinitely*; calibration may be *earned* via accrued exogenous labels
   and is a property a responsibility can reach over time, not only a
   precondition — the gate is satisfiable in principle by every
   responsibility, never unsatisfiable-by-default. Negate it and a confidently
   wrong judge produces confidently wrong action — the class's safety claim is
   void.
7. **Receipts are content-addressed.** Consumers verify evidence instead of
   trusting the producer's claim. The receipt is simultaneously the audit unit, the
   composition unit, and the exit unit. Negate it and Tenets 5 and 6 break at
   once.
8. **State is replayable and exitable.** Given the same contract, event,
   durable state, and adapter outputs, the Reactor decision is reproducible —
   and the contract with its trail can leave for another harness. This is not
   "reproducible for us"; it is "exitable by you" (Tenet 6). Negate it
   and there is no fork-as-exit and no audit.

Demoted to design default (Architecture, not constitution): coarse status,
pressure-as-projection, tiered projection. Each is a strong default that can
change without breaking the class. Tiered projection is retained as a hard
privacy requirement in **Failure model**, not as a class-defining invariant.

### Precedence stack

When invariants tension, this ordering decides:

```text
correctness  >  safety  >  cost  >  interrupt-minimization
```

Interrupt-minimization is a downstream ergonomic property, not a pillar. If
minimizing interrupts ever conflicts with failing safe, safety wins — the
system interrupts even though it would rather be silent. "Rare interruption" is
a target, not a constraint other invariants bend around.

### Architecture

Each layer earns its place as the answer to "what does a beat require?"

| Layer              | Role                                                                                                                                                 | Serves beat                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Responsibility     | The standing goal: what must remain true                                                                                                             | author                       |
| Contract Markdown  | The durable human- and agent-readable source                                                                                                         | author                       |
| Gateway            | Concrete event ingress: schedules, webhooks, queues, files, manual requests; forecast-paced polling only where a source cannot push                  | walk away                    |
| Compiler           | Lowers semantic Markdown into deterministic IR                                                                                                       | author                       |
| Policy compile     | Model authors control policy; compiled to a token-free registry; recompiled when the policy itself drifts                                            | walk away                    |
| Storage            | Holds responsibilities, revisions, observations, runs, decisions, forecasts, receipts, projections                                                   | exitable trail               |
| Judge              | Bounded sensing activation; variable depth; emits status **and a calibrated confidence** (ensemble disagreement is the uncertainty signal)           | interrupted only when needed |
| Reactor            | Typed policy execution deciding the next reconciliation action; fails safe under uncertainty                                                         | interrupted only when needed |
| Forecast           | Load-bearing: manufactures the minimum necessary re-render when the world will not announce change; injects the staleness clock as a synthetic input | walk away                    |
| Fulfillment        | Bounded actuation; the only place world-mutation is allowed                                                                                          | walk away                    |
| Cost / token-truth | Local, deterministic, free token receipts; fresh-vs-reused recoverable                                                                               | verifiable trail             |
| Truth oracles      | One pluggable socket, two distinct concepts (see Failure model)                                                                                      | verifiable trail             |
| Projection         | Owner, subscriber, public, and local views                                                                                                           | exitable trail               |
| Receipt            | Content-addressed proof; carries `as_of`, `next_forecast_recheck`, and a judge-authored blocked reason + recommended fix target                       | verifiable / exitable trail  |
| Composition        | The dependency graph is the evidence graph                                                                                                           | author / verifiable trail    |
| Adapters           | Filesystem, Postgres, sandbox, connector, signer, event sinks                                                                                        | walk away                    |

The most important boundary is between semantic intelligence and harness
machinery:

```text
Markdown source defines intent.
Skill and interpreter docs define semantics.
The model authors policy; the compiler lowers it into IR.
The harness serves IR and runs the compiled policy.
Runs interpret and act inside bounded activations.
The Reactor reconciles. Receipts attest.
```

**Two adapter seams, never merged.** The bounded-activation **agent SDK**
(`codex-sdk`, `claude-sdk`, …) is an adapter and nothing more: no Reactor
control logic ever lives inside it — the kernel, memoization, forecast, and
policy execution are the package's, not the activation runtime's. Distinct
from it is the **model-gateway socket** (OpenRouter as the batteries-included
default; direct Anthropic/OpenAI first-class), which serves raw multi-provider
inference. It is the *inference substrate* the agentic activations draw on —
the judge ensemble's multi-provider votes and calibration, and the inference
consumed by the agentic policy author (which is itself launched via the
agent-SDK seam and explores receipt history dynamically, never a one-shot
call — see *The two compiles*). Keeping
the two seams separate is what makes the policy-author migration in *The two
compiles* free: the launch representation can move from an adapter call to an
OpenProse responsibility without touching the artifact, the kernel, or the
backstop. This is invariant 3 doing load-bearing work, not a convenience.

Design defaults that are not constitutional: status is coarse (`up`,
`drifting`, `down`, `blocked` route maintenance); pressure is a projection that
wakes work, not a second policy engine; projection is tiered.

The `blocked` status carries a judge-authored, natural-language reason **and a
recommended fix target**. "The sentence itself is undecidable — criterion X has
no observable referent" is an expected, high-value verdict, routed to the
contract author (Tenet 2). It is _not_ a new deterministic status; the four
coarse statuses stay minimal, and the differentiation lives in the judge's
diagnosis, not an enum. This is the flagship instance of "interrupt only when a
human is genuinely needed," not error handling.

**Interrupt taxonomy.** An interrupt is a typed Reactor decision with its own
receipt, never a generic action — there are no "just FYI" pings. Its cause is
one of exactly three: `needs-judgment` (a call only a human can make,
including the undecidable-contract case above and the
`calibration-unattainable` case from the failure model), `needs-input` (a credential,
permission, or disambiguation only the human can grant), or `contract-declared`
(escalation the author wrote into the contract, e.g. "page me if this goes
down"). The model **never invents an interrupt**: it self-initiates only for
the first two; `contract-declared` paging is user-authorized, not model-chosen.
The lived-experience promise's "exactly two conditions" refers to
self-initiated interrupts; contract-declared paging is the user's own rule
firing. Per the precedence stack, interrupt-minimization yields to safety.

### Failure model

The architecture must be safe when its own intelligence is unreliable. Two
independent layers:

- **Judge-quality layer.** Epistemically sound LLM-as-judge: the judge knows
  its observations are partial; inter-model consensus across model classes and
  sizes (critic, dialectic, K-consensus, fan-out) raises quality. Its real
  output is not just a verdict but a confidence signal. **Ensemble spread is
  the confidence estimator only in the regime where it is measured to be
  calibrated.** Calibration is not assumed; it is continuously measured against
  the bring-your-own-correctness-truth anchor and recorded as a receipt. While
  the measured spread→error relationship meets the calibration bar, no separate
  estimator is needed. When the bar is not met — including the no-anchor
  cold-start case — the judge enters **degraded-calibration mode** (defined
  below) and may not use low spread as a license to skip escalation:
  correlated models sharing training lineage can be confidently jointly wrong,
  so low spread is treated as evidence of confidence only after it has been
  shown to track error on this responsibility's anchor.
  **Ensemble diversity is a correctness requirement, not a tuning option.**
  Temperature/sampling diversity does not decorrelate shared training-data and
  RLHF blind spots and does not count toward the diversity floor: an ensemble
  qualifies as diverse only if it spans ≥2 model families from ≥2 providers and
  crosses a size boundary; the calibration receipt records the realized
  family/provider/size mix, and a single-family ensemble is automatically
  degraded-calibration regardless of measured spread. Judge ensembling is a
  model-gateway-socket concern, never an agent-SDK concern — it cannot be
  satisfied by the same model run through two agent adapters.
- **Degraded-calibration mode.** When measured calibration is below bar,
  calibration evidence is stale, or the diversity floor is unmet, the
  variable-depth judge degrades safely and the precedence stack governs:
  (1) **escalate-by-default** — low spread no longer authorizes the cheap path;
  default depth becomes the escalated ensemble, inverting quiescence behavior 3
  for that responsibility; (2) **weight the anchor** — where a correctness
  anchor exists its label overrides low-spread agreement for the affected
  verdict class, and anchor↔ensemble disagreement is itself a `blocked`
  interrupt routed to the author; (3) **widen the ensemble** — add an
  out-of-family provider via the model-gateway socket before trusting
  agreement; (4) if none of (1)–(3) is available, the responsibility runs in
  **bounded degraded-calibration mode**: escalate-by-default is the steady
  state and confidence is reported *uncalibrated* in every receipt — never a
  silent confident `up`. This mode is **not terminal-by-construction**: it is
  exited when accrued anchor labels (see *Truth oracles*) meet the calibration
  bar. (4b) It becomes a terminal `blocked` — reason `calibration-unattainable`,
  a `needs-judgment` interrupt routed to the author — only when
  escalate-by-default itself cannot run (no diverse ensemble obtainable): the
  system can neither self-assess nor safely escalate. The cost regression from
  escalate-by-default is the _correct_ outcome under correctness > safety >
  cost.
- **Reactor-safety layer.** Independent of judge quality: given that
  confidence, the control policy fails safe (invariant 6). The asymmetry
  between a wrong fulfillment and a wrong inaction is made explicit per
  responsibility — some fail loud, some fail quiet.

The judge is **not a fixed circuit, it is a variable-depth circuit**: cheap
single judge by default, escalate to ensemble only when uncertain or when
stakes or forecast warrant. This is simultaneously the failure-model answer and
the cost answer.

**Truth oracles — one socket, two distinct concepts.** A single pluggable
socket pattern (an external oracle the OSS _calls_ but never _owns_; null-safe
degradation; results flow back as receipt-attached projections) serves two
semantically orthogonal concepts that are **never merged in prose or types**:

- **Bring-your-own-correctness-truth.** Answers "was the verdict right?" Not
  merely a fallback — when present it is a **calibration anchor**: periodically
  score the ensemble against it to measure and correct ensemble bias over time;
  the scoring is itself a receipt. The anchor may be *authored* (the BYO
  oracle) or *accrued*. Accrued labels come from two exogenous sources: human
  confirm/refute responses to a `needs-judgment` calibration spot-check, and
  independently observed fulfillment outcomes. Ensemble-internal agreement —
  including deeper re-judgment — is **not** an anchor source: it measures
  coherence, not correctness, and is explicitly excluded. Accrued labels feed
  the same calibration scorer and receipt as an authored anchor; calibration
  grade is recorded (`authored` | `accrued` | `none`).
- **Bring-your-own-cost-truth.** Answers "what did it cost?" Token-truth is
  recorded locally and deterministically; dollarization is a projection applied
  by a pluggable price oracle. The OSS package is fully functional with no
  price oracle ("not configured" is a clean, non-deceptive null state, same
  honesty bar as the null-signer). Dollarization is a pluggable price-oracle
  projection, never a receipt field; a managed aggregation service is out of
  scope of this specification.

Bad correctness-truth corrupts judgments; bad cost-truth corrupts economics but
not correctness. Same plumbing, different shapes, different consumers, different
failure meanings.

**Cost is a first-class Reactor input, not a dashboard.** Token-truth receipts
feed the forecasted marginal value of the next check; the Reactor trades judge
depth against budget on that basis. Cost is read by the variable-depth judge
when deciding whether to escalate, and by the meta-loop when deciding whether a
recompile is worth its tokens. It is an input to control, not an after-the-fact
report.

**Privacy is a failure mode.** Secrets, emails, private URLs, and customer
payloads must not leak from judge rationale into subscriber or public
projections. Tiered projection is the safeguard: owner and local views may be
rich; subscriber and public views are explicit, narrowed contracts, not ad hoc
response filtering. A privacy leak is treated as a safety failure, not a
cosmetic one — this is the hard requirement referenced from **Core invariants**
where tiered projection was demoted from the constitution.

### Metaphor

Lead with React, and not for palatability — after the unification thesis it is
the _rigorous_ model, with literal mappings:

| React                          | Reactor                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| render                         | the compile / policy-derivation step                                |
| committed output               | the deterministic schedule + threshold registry                     |
| re-render                      | recompile, triggered by a dependency change, not a clock            |
| partial reconciliation         | quiescence; only changed subtrees re-judge                          |
| memoization / dependency array | input-hash verdict reuse                                            |
| render vs. effect              | judge (pure: world → status) vs. fulfill (commit-phase side effect) |
| composition / lifting state up | responsibilities consuming each other's receipts                    |

Kubernetes' controller is a _weaker_ version of the same idea —
reconcile-to-desired-state with no render/commit split, no memoization, no
composition. It is a subset; a one-line footnote acknowledges the lineage.

The metaphor is **explicitly bounded**. React renders are synchronous, cheap,
and the tree does not mutate mid-render; Reactor "renders" are expensive,
asynchronous, and the world mutates underneath them. So React owns the
**structural** dimension; **control-systems** language (forecast, hysteresis)
owns the **time/cost** dimension. Two metaphors, each owning exactly one
dimension. Three seams are where they meet, stated as resolution rules:

1. **Memoization vs. forecast.** On a quiet input, React says "skip"; control
   systems says "drift probability rose, re-check." Resolution: forecast
   injects the staleness clock as a **synthetic input** into the memo key, so
   "no real change but forecast says recheck" becomes a hash change. Control
   systems _feeds_ React; it does not override it. This is what makes silence
   _safe_ rather than _negligent_.
2. **Pure render vs. side-effecting world.** Judge stays pure (world → status);
   all world-mutation is quarantined in fulfillment (the commit phase), or the
   render-purity claim breaks.
3. **Synchronous tree vs. asynchronous world.** A verdict is always `as_of` a
   timestamp, never "now." Every receipt carries `as_of`; that is where
   control-systems time-awareness patches React's frozen-tree assumption.

### Composition

It needs **no new primitive**. "B depends on A" = B's judge consumes A's latest
receipt as evidence, identical to a webhook. Three consequences make it native,
not a bolt-on:

- **Propagation reuses memoization exactly.** A's new receipt is an input-hash
  change for B → B re-judges; if B is unchanged, propagation stops. The
  dependency graph reconciles by the same memoized partial-render mechanism as
  a single responsibility, recursively.
- **Cost amortizes for free.** A is judged once; N dependents reuse A's
  receipt. Dependency-graph amortization falls out of the architecture.
- **Fork/exit composes.** The edge is "consume receipt at content-address /
  responsibility-ref" — a reference, not a hidden binding. Public
  responsibilities become composable public goods (Tenets 5, 6 land on
  one object).

Three genuine collisions, with their resolutions:

1. **Cycles** (A→B→A). Detection is a graph property: deterministic and cheap;
   it belongs in the small fixed kernel.
2. **Cross-boundary trust.** B must verify A's receipt signature _and_ contract
   revision. A public A's owner can silently change semantics, so the
   dependency edge must **pin a contract revision and an acceptable signer
   set**, or composition becomes a supply-chain attack. This is where Tenet 5's
   "verify, don't trust" does real load-bearing work.
3. **Transitive staleness.** A quiesced A may hand B a stale-but-true-looking
   receipt. Each receipt's `freshness` block carries `as_of` and
   `next_forecast_recheck`. The rule by which B combines its own `as_of` with
   each consumed receipt's `freshness` to decide whether its inputs are fresh
   enough is **not at the judge's discretion and not a fixed kernel
   constant**: it is a **model-authored policy parameter recorded in the
   policy registry** — the *transitive-freshness function* — alongside
   cadence, hysteresis, and the plan-audit clock as a falsification-predicate
   input under *The two compiles*. The kernel is its dumb evaluator. The
   conservative default the model authors against, and the backstop the
   kernel enforces regardless of the authored function, is: *B's inputs are
   stale, and B must refetch or block, if any consumed receipt's
   `next_forecast_recheck` is at or before B's evaluation `as_of`.* The model
   may author a *looser* bound only where the contract's freshness criterion
   justifies it and the falsification predicate scores that looseness against
   observed downstream drift; never looser than the kernel backstop. For a
   chain A→B→C this composes by construction: each hop applies its own
   recorded function to its own consumed receipts, every one replayable
   against a pinned policy revision. Freshness is therefore transitive **and
   explicit in the schema and the policy registry** — never a discretionary
   per-cycle judgment (invariant 8, Tenet 6).

### Open specification items

Deferred by design — named here so they are tracked, not invented or silently
dropped:

1. **Receipt schema — v0 pinned; provider-normalization sub-object deferred.**
   The receipt schema is **pinned at v0** (`openprose.receipt`, `v: 0`): a
   content-addressed `core` (responsibility id, pinned contract revision, event
   cause ∈ {real-input, forecast-recheck, escalation} (a `forecast-recheck`
   additionally carries `recheck_kind ∈ {evidence-age, plan-age}` so the
   plan-audit floor is sliceable from ordinary forecast rechecks without a
   fourth top-level cause), memo key, evidence input
   ids, `as_of`, role ∈ {judge, fulfill, summarize, policy-compile}) hashed
   under a named algorithm; a `sig` block where `scheme: "none"` with a
   `null_reason` is a first-class, non-deceptive state alongside an optional
   signer adapter; a `verdict` carrying one of the four coarse statuses, calibrated
   confidence with its derivation method plus calibration grade
   (`authored` | `accrued` | `none`) and label source, and a judge-authored
   `blocked` reason + fix target + interrupt cause; a `freshness` block
   carrying `as_of`, `next_forecast_recheck`, and — on a receipt produced by a
   B that consumed upstream receipts — `transitive_freshness_policy_ref` (the
   policy revision whose transitive-freshness function was applied) and
   `consumed_freshness_evaluated` (per consumed receipt, its
   `next_forecast_recheck` and the kernel's staleness outcome ∈ {`fresh`,
   `stale-refetched`, `stale-blocked`}); a `composition` block whose `consumed_receipts`
   each pin upstream content-hash, contract revision, and acceptable signer
   set, plus a kernel-set cycle-checked flag; and a `cost` block where
   token-truth is sliceable along provider, model, role, tags, responsibility,
   run, and time, with `tokens.fresh` vs `tokens.reused` and a `surprise_cause`
   making the cost-scales-with-surprise and memoization proofs recoverable from
   a single receipt. Tags are not optional metadata; they are what lets cost be
   sliced after the fact. **The only deferred element is the contained
   `cost.provider_norm` sub-object** — cache-write vs cache-read price, TTL, and
   minimum-cacheable thresholds normalized across Anthropic/OpenAI/Gemini/Grok
   — which awaits the unrun provider/model matrix and carries its own
   independent `schema` version so provider research changes that sub-object
   alone, never the receipt shape. Dollarization remains a pluggable
   price-oracle projection, never a receipt field; a managed aggregation
   service is out of scope of this specification. This deferral is
   non-blocking: the v0.1/v0.2 policy-author milestones and the composition,
   supply-chain, and exit/export claims depend only on pinned fields.
2. **The deterministic kernel.** Specified in principle (see _The unification
   thesis_ and _Quiescence_): a dumb evaluator of the policy's
   model-authored falsification predicate, plus a tiny fixed backstop (max
   policy age, min recompile interval, max calibration divergence, warmup
   length, rollback comparison) and cycle detection. The backstop constants are
   pinned conservative-by-default and tuned empirically: **max policy age** — a
   hard ceiling forcing recompile/revalidation regardless of predicate state
   (seed: 30 days); **min recompile interval** — anti-thrash floor and
   meta-loop hysteresis (seed: 1 hour); **max calibration divergence** —
   observed drift exceeding the policy's predicted curve by ≥2×, or escalation
   precision falling materially below the policy's claimed threshold, forces
   recompile; **max calibration-evidence age** — if the correctness anchor has
   not scored the ensemble within this age, calibration is presumed stale and
   degraded-calibration mode engages (see _Failure model_). **Rollback-
   comparison definition:** _last-known-good_ is the most recent policy that
   completed its full warmup without tripping its own falsification predicate;
   a fresh policy `P_n` auto-reverts to `P_{n-1}` if `P_n` trips its own
   predicate in **fewer judged activations** (event-volume-normalized, not
   wall-clock) than `P_{n-1}` took to first trip its own. All constants are
   policy-registry-recorded and replayable; tightening them is a backstop
   change, not a policy recompile. **No-anchor soundness additions:** (B1) for
   a responsibility with no correctness anchor, `max policy age` is replaced by
   `max policy age (no-anchor)` — seed 7 days — because the anchor-derived arms
   (calibration divergence, calibration-evidence age, rollback) are inert in
   that regime. (B2) Independent of the policy's falsification predicate and of
   any model-authored clock, the kernel forces a deep, roaming revalidation at
   a fixed cadence (`max-unforced-deep-interval`, seed 7 days,
   event-volume-normalized); if its verdict materially contradicts the
   shallow-policy history the kernel records a `backstop-divergence` receipt
   and forces recompile — supplying the observed-vs-predicted term an
   anchorless calibration check otherwise lacks. (B3) A policy artifact is
   rejected at validation if its falsification predicate references no live
   observable (no anchor, no calibration-divergence input, nor — for a
   no-anchor responsibility — the B2 contradiction signal): a predicate
   falsifiable against nothing is malformed, not valid. B2+B3 ship together;
   B1 is the interim fallback. These are fixed kernel constants the model may
   not lengthen.
3. **Calibration cadence.** How often the ensemble is scored against
   bring-your-own-correctness-truth is unspecified.
4. **Meta-loop hysteresis.** "Do not recompile policy too eagerly" is a
   principle, not yet a parameter.
5. **Policy-registry artifact format.** The token-free deterministic registry
   the kernel executes is owned by `@openprose/reactor` (not IR, not
   `*.prose.md` syntax — see [01-Language.md](./01-Language.md) Part III §3). Its
   lifecycle, trigger, input, and correctness test are specified in _The two
   compiles_; its **on-disk format/schema is deferred**. Like the receipt
   schema (item 1) it is expected to be largely deducible — a versioned static
   artifact, validated by deterministic code, replayable, receipted, carrying
   the model-authored falsification predicate and the policy parameters
   (cadence, hysteresis band shapes, escalation thresholds, the plan-audit
   clock from _The completeness law_). It must meet the same "static artifact
   consumed and validated by deterministic code" safety bar as the receipt.
   Penciling a v0 here is a tracked follow-up and is not believed to be a
   blocker.
6. **Accrued-anchor calibration bar.** How many exogenous labels (human
   spot-check confirmations or observed fulfillment outcomes), over what
   window, at what agreement, lifts a no-anchor responsibility out of
   bounded degraded-calibration mode, and the spot-check sampling cadence,
   is unspecified. Distinct from item 3 (which governs *authored*-anchor
   scoring cadence and presumes an anchor exists); cross-reference both ways.

### Where it excels

The reusable judgment is in the properties, not a list of domains. Reactor-class
harnesses are strongest when:

- the goal is a **state to maintain**, not a one-shot deliverable;
- events arrive over time from multiple sources;
- the world state is partly ambiguous and requires judgment;
- the system must avoid duplicate or thrashing actions;
- the value of acting depends on freshness, confidence, risk, or cost;
- the user needs an audit trail for why an action happened;
- the implementation may change while the declared intent stays stable;
- multiple models may perform differently across judging, fulfillment, and
  summarization.

Weak fits: one-off report writing; pure batch transforms; low-stakes throwaway
prompts; deterministic jobs that need no judgment; workflows where every step
is already known and stable; tasks where public receipts or durable state add
more friction than value. OpenProse can still run one-shot services; they are
just not the canonical case.

Three costs are now structurally irreducible and must be stated honestly. **A
plan-revalidation tax:** provable quiescence is "zero tokens _between
forecast-paced plan audits_," not "zero tokens on a static world." The honest
claim is _cost scales with surprise plus a forecast-amortized plan-audit
floor_ — the floor pushed arbitrarily low (never to zero) by calibration, as
a plan that has survived N audits unchanged earns a longer interval. **A
no-cheap-hash domain boundary:** where deciding "did the semantically relevant
content change" essentially _is_ the judgment (research novelty, regulatory
drift, competitive framing), no cheap-and-complete identity exists; the system
stays correct and safe (forecast still manufactures the recheck) but loses the
cost differentiator and degrades gracefully to forecast-cadence cost. Reactor
excels where a cheap stable identity exists; semantic-only-drift domains are a
documented boundary, not a hidden failure. **A no-anchor calibration tax:** a
responsibility with no authored correctness anchor runs permanently
escalate-by-default until it accrues enough exogenous labels (human spot-check
or observed fulfillment outcome) to earn calibration. Like the no-cheap-hash
boundary this is a stated, deliberate correctness > cost trade, not a hidden
failure; some responsibilities (projection-only, slow-feedback, spot-check
declined) never accrue labels and remain in this mode by design.

One worked example, kept here because it demonstrates the thesis better than
any other — the world mutates with every message, so cost must scale with
surprise, not time:

#### Incident Briefing Room

```text
Goal: The incident channel has an accurate current briefing.
Continuity: Recheck on incident messages, status-page changes, and every 15 minutes while active.
Criteria: impact, timeline, owner, next action, and customer-facing status are current.
Fulfillment: summarize new facts, ask for missing owner input, update the briefing.
```

The modeled world changes with every message. The desired output is not "answer
once"; it is "keep the briefing true" while spending tokens only on what
actually changed. Additional worked examples are catalogued in Part II.

---

## II. What Exists Today

This section assumes the responsibility CLI harness branch is merged to main
and released: `@openprose/responsibility` is used by the open source
CLI/server, with the skill-level Reactor doctrine repurposed around that
package.

**Read this part as prior art mined, not a foundation being extended.** The
Reactor package is greenfield — `@openprose/reactor` is built fresh against
the Part I spec. What carries forward from the older
`@openprose/responsibility` is not its policy core but hard-won operational
scars — crash-window replay, durable pressure-dispatch claims, restart
recovery — requirements discovered the expensive way. Everything below
describes what physically exists today and remains factually accurate; its
role, however, is the quarry, not the scaffold. The Conformance Ledger tracks
`@openprose/reactor`'s climb toward Part I, not the retrofit of the prior
package. **`@openprose/responsibility` is not on the shipping path and is
scheduled for deletion; it is retained only as referenceable prior art whose
architecture diverges from the plan. All release, pin, and parity gates target
`@openprose/reactor`.** Where passages below still name
`@openprose/responsibility`, read it as the soon-to-be-deleted prior package
being mined, never as the artifact that ships.

### Existing Open Source Surface

| Surface             | What Exists                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract Markdown   | `*.prose.md` source files with `service`, `system`, `gateway`, `test`, `pattern`, and `responsibility` kinds                                      |
| Responsibility docs | `skills/open-prose/responsibility-runtime.md`, `concepts/responsibility.md`, and `concepts/reactor.md`                                            |
| CLI                 | `prose compile`, `prose serve`, `prose run`, and `prose status`                                                                                   |
| Examples            | release readiness, incident briefing, customer risk, compliance evidence, research inbox, content performance, vendor renewal, stargazer outreach |
| State layout        | `runs/`, `state/`, `state/responsibilities/`, and package-owned responsibility runtime state                                                      |
| Agent hosts         | Codex, Claude, and mock harness support                                                                                                           |

The open source repository can already show the _shape_ of a Reactor-class
harness: authored responsibilities, compiled intent, local serve, bounded
activations, status files, pressure, and status inspection.

### Responsibility Catalog

These worked examples were moved out of Part I (one example is enough to teach
the thesis) but remain a useful catalog. The corresponding contracts ship as
runnable examples (see Release-Candidate Inventory).

- **Release readiness** — `Goal:` the release candidate is ready to ship;
  check before every planned release and when release evidence changes;
  criteria are tests pass, rollback exists, blockers resolved, notes current.
- **Customer risk radar** — `Goal:` renewal risks for named customers are
  surfaced before account reviews; check weekly and on support/CRM/product
  signal change; the value is a maintained risk view, not one classification.
- **Compliance evidence tracker** — `Goal:` required control evidence is
  current enough for the next audit; benefits directly from receipts and tiered
  projection (rich owner evidence, sanitized public proof).
- **Research inbox triage** — `Goal:` new research leads are classified and
  routed each workday; makes model differences visible (some classify better,
  some are cheaper for routine fulfillment).

### Shared Responsibility Package

`@openprose/responsibility` is the shared TypeScript package for responsibility
judging, forecasting, Reactor decisions, runtime loops, traces, receipts, and
storage adapters. In the release-candidate state it is no longer merely a
backend dependency: the CLI imports it and uses it as the typed Reactor
authority. Under the greenfield decision this package is **prior art**:
`@openprose/reactor` reimplements the Part I spec from scratch and salvages at
most interface shapes and the operational scars named above — never the policy
core.

The package contains:

- pure Reactor decision logic
- forecast logic
- contract and protocol types
- runtime loop machinery
- filesystem and Postgres adapter surfaces
- judge protocol interfaces
- investigation, trace, summary, and receipt shapes
- storage fencing and replay-oriented records

It is the compiled runtime policy the CLI/server runs.

### CLI Reactor Bridge

The CLI release-candidate branch adds a package-backed Reactor bridge that does
three jobs:

1. converts local OpenProse responsibility status records into package runtime
   inputs;
2. calls the shared Reactor/runtime package to produce decisions, schedules,
   forecasts, and next actions;
3. mirrors compact local projections for `prose status` and ordinary
   fulfillment activations.

Local `prose serve` is no longer an agent-interpreted version of the Reactor
concept; it uses the same package policy as the backend. The bridge includes:

- package-backed decision recording after judge status
- package-owned runtime state under the OpenProse root
- compact local projections under `state/responsibilities/{id}/`
- status, pressure, and Reactor decision history
- scheduled judge and fulfillment handling
- durable pressure dispatch claims
- restart recovery for scheduled work
- restart recovery for due but undispatched pressure
- crash-window replay when status exists without a matching Reactor decision
- deterministic decision replay from supplied timestamps
- validation of Reactor decision records
- line-numbered errors for invalid local Reactor history

This is the first credible form of a single shared policy across hosts.

### Skill-Level Reactor Doctrine

The skill docs are no longer the runtime implementation by proxy; they are the
doctrine and authoring frame around the package.

| Layer                       | Role                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| SKILL docs                  | Explain how agents should understand responsibilities, Reactor, pressure, and bounded runs |
| Contract Markdown           | Gives authors the durable source language                                                  |
| Compiler docs               | Define how source lowers into repository IR                                                |
| CLI harness                 | Serves compiled IR and calls the shared package                                            |
| `@openprose/responsibility` | Owns typed Reactor decisions, forecasts, runtime state, and receipts                       |

### Package Consumers

`@openprose/reactor` has one consumer: the CLI/server. The 2026-05-13 judge
architecture buildout moved the core Reactor, forecast, runtime loop, storage
adapter, judge protocol, and receipt concepts into the shared package so the
CLI is glue rather than policy.

- The shared package owns runtime decisions.
- Postgres is an optional durable storage *adapter* alongside the filesystem
  default — not a cloud surface; it stores durable cycles, runs, decisions,
  forecasts, receipts, and projections.

Parity is therefore not CLI-vs-backend but cross-adapter and cross-replay: the
same package over the same fixtures produces byte-identical policy outputs
across storage adapters and across runs.

### Conformance Ledger

Part I states the invariants as an unqualified north star. This ledger is where
reality is honest. Near-term breakage is acceptable when it is recorded with a
plan; strictness lives in the ideal, the ledger tracks the climb. Every "plan"
column below is `@openprose/reactor`'s greenfield climb; `@openprose/responsibility`
appears only as the prior art whose scars informed the plan, never as a base
being patched.

**2026-05-18 — `@openprose/reactor` v0.1 spine, W1–W6 accepted.** The
greenfield package's permanent spine (receipt v0 + token-truth substrate,
deterministic kernel incl. fixed backstops with fail-closed seed semantics,
rollback-to-last-known-good, cycle detection, the B1/B2/B3 no-anchor additions
with a model-authored `backstop_divergence_predicate` the kernel only
evaluates, a bounded-`indeterminate`→`needs-judgment` primitive, the compiled
evidence plan, the memoization primitive, forecast-gated scheduling, and the
adapter-injected SDK seam) is implemented and passed an overseer breadth-first
acceptance review with 37 deterministic tests green via the documented
command. This is unit/contract-verified substrate, **not** an empirical proof
of the cost thesis — that remains the v0.1 acceptance gate (the Cradle
static-world flat-token scenario). Build-out: `planning/plans/2026-05-18-reactor-harness-ideal-architecture/`.

**2026-05-19 — Phase A runtime acceptance landed.** The build now has a
runtime-produced W7 static-world Cradle path: `runScenarioV0` drives a public
`createReactor` handle, the passing path reads `reactor.receipts()`, and the
old hand-built W7 receipt table is out of the acceptance path. Observed token
shape: bootstrap real input `fresh=41`; evidence-age rechecks `fresh=0` with
reused tokens; plan-age audit floor `fresh=5`. The same wave added one-shot
cold-start policy authorship through the agent-SDK adapter and export/import
registry hydration with a byte-identical next-decision round trip.

**2026-05-20 — B5 live K1 cassette landed.** One OpenRouter K1 ensemble
recording now exists at
`packages/reactor-cradle/src/spikes/fixtures/k1-live-recorded.json`. It spans
`google/gemini-3.1-flash-lite-preview` (small),
`mistralai/mistral-small-3.2-24b-instruct` (small), and
`qwen/qwen-2.5-72b-instruct` (large), with provider and family diversity;
records request ids, response ids, latency, finish reason, usage,
provider/model names, and spend metadata; and passes the same K1 evaluator as
the recorded diverse fixture. Actual spend: `0.00022823 USD` under the
`2.00 USD` cap. Cassette file SHA-256:
`f64484990635a61a3dcac973a96e97d6433a576ccc297c23742d4a515e2c1868`. This is
live calibration evidence, not runtime variable-depth ensemble judging.

**2026-05-20 — Wave 1 CLI scars and projections landed.** CLI commit
`153bab8` landed the release-readiness real source-to-IR compile path, real
fulfillment artifact path, crash-window replay, and owner/subscriber/public
status tiers. Gate hardening commit `979bacd` closed the sharper
duplicate-trigger observable: two identical `POST /release/readiness` triggers
in one serve cycle now produce exactly one Reactor receipt, one durable
pressure record, one pressure claim, and one fulfillment dispatch. Reviewer
repair commit `ddfd023` tightened the operational scars: crash replay now kills
after a pressure dispatch claim is on disk but before fulfillment completes,
and duplicate-trigger dedupe now survives distinct HTTP receive timestamps via
a normalized `triggerDedupeKey`. Follow-up commit `8e68133` makes
`pressure.latest.json` replay-safe under full-suite load by using an atomic
latest write and a parseable-pressure test wait. The focused E6 suite is
8 files / 10 tests green; full CLI suite is 25 files / 263 tests green. This
closes the local operational-scar and privacy-projection
substrate for Phase E; it does not claim production ingress/fulfillment/oracle
or public stranger-run evidence.

| Invariant                                     | State      | Gap / Plan                                                                                                                                                                                                                              |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Markdown is intent                         | Conformant | `*.prose.md` is the sole semantic source; the kernel reads source meaning only via the pinned `contract_revision` content hash — no second authored surface                                                                              |
| 2. Policy is model-authored, compiled, shared | Partial    | Deterministic kernel executes model-authored policy artifacts; runtime cold start now invokes `authorPolicyArtifactV0` once through the agent-SDK adapter and persists revision `1`. The model-authored, recompiled-on-drift two-timescale loop is v0.2 |
| 3. Adapters are the only reason hosts differ  | Recorded provider parity | SDK seam injects all adapters with no hidden defaults (verified); Phase C recorded two named provider/model paths producing byte-identical policy artifact bytes with fail-closed provider drift. This is recorded provider parity, not live provider support or model quality parity |
| 4. Activations are bounded                    | Conformant | Continuity lives in durable state; no long-running session                                                                                                                                                                              |
| 5. Cost scales with surprise                  | Measured v0.1 with controls | Phase C's report table measures the same scenarios through runtime-produced Reactor receipts and deterministic controls. Static Reactor/no-memo/naive-loop is `46:46` / `92:0` / `256:0`; event-changing Reactor/no-memo/naive-loop is `74:74` / `148:0` / `148:0`. The no-memo and naive-loop rows are controls, not shipped runtime modes |
| 6. The judge fails safe                       | Partial + one live K1 cassette | Kernel fail-safe substantially built & verified: fail-closed seed semantics, degraded-calibration ladder, bounded-`indeterminate`->`needs-judgment`, every fail/blocked outcome a content-addressed receipt. B5 adds one live-recorded OpenRouter K1 cassette accepted by the evaluator (`google/gemini-3.1-flash-lite-preview`, `mistralai/mistral-small-3.2-24b-instruct`, `qwen/qwen-2.5-72b-instruct`; SHA-256 `f64484990635a61a3dcac973a96e97d6433a576ccc297c23742d4a515e2c1868`); runtime variable-depth ensemble judging remains post-launch |
| 7. Receipts are content-addressed             | Partial + CLI projection tiers | Receipt v0 content-addressing real & verified (canonicalization, `evidence_input_ids` content-addressed, `as_of`/`next_forecast_recheck`, fresh-vs-reused). E15 wires `prose status --tier=owner|subscriber|public`; the secret-injection test proves owner projection can see owner-only receipt data while subscriber/public output does not leak secret-shaped tags or rationale. Signing path is null-only; cross-adapter parity not yet a gate |
| 8. State is replayable and exitable           | Partial + local operational scars | Runtime receipt logs export/import with registry hydration, and a fresh reactor can import a runtime-produced log then produce the same next receipt hash as the original. E13/E14 add local CLI scars: restart after a post-claim/pre-fulfillment crash converges from durable, atomically written pressure within one cycle, and duplicate identical triggers short-circuit to exactly one fulfillment dispatch. Phase C records memory/filesystem storage parity and an honest Postgres defer until the storage seam becomes async |

The same honesty discipline already applies to null-signer and the unpublished
package (see Honest Current Limits).

### Existing Tests And Release Checks

- responsibility package unit, runtime, adapter, judge, and type tests
- CLI unit and integration tests
- repository IR tests
- responsibility status and pressure tests
- package-backed CLI Reactor bridge tests
- serve daemon scheduling and restart recovery tests
- CLI crash-window replay and duplicate-trigger idempotency tests
- owner/subscriber/public projection secret-injection tests
- package dry-run checks
- CLI release preflight checks
- responsibility package pin verification
- lock-step intent around exact package content hashes

What they prove: the package can be built, packed, imported, tested; the CLI
uses the package instead of a separate local policy; local state records are
validated and replayable; scheduling, pressure dispatch, and restart recovery
work for important local cases; release packaging can be checked before publish.

What they do not yet prove: Reactor-class is the best architecture for target
domains; the harness outperforms simpler baselines; forecasts improve cost,
freshness, or reliability; hysteresis reduces oscillation under noisy judgment;
model families behave differently inside the harness; public projections and
receipts are robust enough for a technical report; real-world case studies
converge over long horizons; **cost scales with surprise** under measurement.

### Release-Candidate Inventory

| Area               | Location                                                                                                | Current Role                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Shared package     | `platform/packages/responsibility/`                                                                     | Core types, Reactor, forecast, runtime loop, storage adapters, judges, traces, summaries, receipts                            |
| Reactor policy     | `platform/packages/responsibility/src/core/reactor.ts`                                                  | Typed decision policy: scheduling judges, fulfillment, retry, escalation, human review, quiescence                            |
| Forecast policy    | `platform/packages/responsibility/src/core/forecast.ts`                                                 | Drift and truth-probability forecasting used to pull future checks earlier                                                    |
| Runtime loop       | `platform/packages/responsibility/src/runtime/loop.ts`                                                  | Shared runtime loop used by cloud and local adapter compositions                                                              |
| Filesystem adapter | `platform/packages/responsibility/src/adapters/storage-fs.ts`                                           | Local durable package state for the CLI harness                                                                               |
| Postgres adapter   | `platform/packages/responsibility/src/adapters/storage-pg.ts`                                           | Cloud durable package state for the API backend                                                                               |
| CLI bridge         | `platform/external/prose/tools/cli/src/prose/responsibility-reactor.ts`                                 | Converts local judge status into package runtime inputs; mirrors decisions into local projections                             |
| CLI serve loop     | `platform/external/prose/tools/cli/src/prose/repository-serve.ts`                                       | Launches bounded judge and fulfillment activations, records package-backed Reactor decisions                                  |
| CLI daemon         | `platform/external/prose/tools/cli/src/prose/repository-serve-daemon.ts`                                | Schedules judge and fulfillment actions, restores pending work, replays crash-window status                                   |
| Local pressure     | `platform/external/prose/tools/cli/src/prose/responsibility-pressure.ts`                                | Durable pressure projection and dispatch claim support                                                                        |
| Local status       | `platform/external/prose/tools/cli/src/prose/responsibility-status.ts`                                  | Judge status records, confidence, coverage, timestamp validation                                                              |
| Local status view  | `platform/external/prose/tools/cli/src/prose/repository-status.ts`                                      | `prose status` projection over IR, status, pressure, Reactor decisions                                                        |
| Skill doctrine     | `platform/external/prose/skills/open-prose/responsibility-runtime.md`                                   | Agent-facing Responsibility Runtime with package-backed Reactor semantics                                                     |
| Reactor concept    | `platform/external/prose/skills/open-prose/concepts/reactor.md`                                         | Conceptual definition of evented reconciliation, status, pressure, cadence, fulfillment                                       |
| Contract docs      | `platform/external/prose/skills/open-prose/contract-markdown.md`                                        | Markdown source contract surface for responsibilities and gateways                                                            |
| CLI package        | `platform/external/prose/tools/cli/package.json`                                                        | Public CLI package depending on `@openprose/responsibility`                                                                   |
| Backend pin        | `platform/apps/api/.openprose-pin.json`                                                                 | Content hash tying the backend to the expected responsibility package artifact                                                |
| CLI tests          | `platform/external/prose/tools/cli/tests/prose/`                                                        | Repository IR, serve, status, pressure, Reactor bridge coverage                                                               |
| Package tests      | `platform/packages/responsibility/src/**/__tests__/` and `platform/packages/responsibility/test-types/` | Core/runtime/adapter/judge/type coverage                                                                                      |
| Examples           | `platform/external/prose/skills/open-prose/examples/`                                                   | Runnable responsibility examples for release readiness, incidents, customer risk, compliance, inbox triage, and related loops |

This is enough to say the Reactor-class harness exists as software. It is not
yet enough to say the public category claim is proven.

The boundary with the language is explicit and stated from both sides:
repository IR v0 is frozen and source-derived, while the policy artifact,
token-truth receipts, forecasts, and decisions are sibling runtime state owned
by `@openprose/reactor` — not IR fields and not `*.prose.md` syntax (see
[01-Language.md](./01-Language.md) Part II "Repository IR v0" and Part III §3).

### Honest Current Limits

- `@openprose/reactor` must be published publicly before the CLI release
  can depend on it cleanly.
- Cross-adapter/replay parity should become a required CI gate, not only a local proof.
- The model matrix has not been run across Anthropic, OpenAI, Gemini, and Grok.
- Baselines and ablations have not been collected.
- Long-horizon responsibility simulations are not yet a standard suite.
- Public receipts and projection guarantees need launch-grade evidence.
- The two-timescale policy loop, variable-depth judging, token-truth receipts,
  and composition-via-receipts are designed (Part I) but not yet implemented.
- The technical report has not been written from measured results.
- "Reactor-class harness" is not yet pinned to a formal public spec and
  evaluation methodology.

> The implementation is strong enough to justify the category thesis. The
> category should launch only after the evaluation and evidence suite makes the
> claim difficult to dismiss.

---

## III. What Is Next

Turn the Reactor-class harness from a plausible architecture into a published
technical claim.

### Launch Standard

Do not publicly launch "Reactor-class harness" until three artifacts ship
together:

1. A release-quality open source CLI using `@openprose/reactor`.
2. A technical report defining the class, architecture, baselines, and results.
3. A reproducible eval suite that lets others inspect the claim.

The bar:

```text
Can we credibly say this architecture is novel, simple, high quality, based on
proven systems patterns, and empirically useful for event-based high-complexity
rerenders of modeled world state — and that its cost scales with surprise, not
time?
```

### Required Engineering Work

#### 1. Publish And Pin The Shared Package

Public npm release; provenance; packed `dist`; exact version pin from the CLI;
CI verification that the installed package matches the expected hash; release
workflow that fails if local source and published package diverge. This is the
minimum proof the published package and local source match.

#### 2. Make Cross-Adapter / Replay Parity A Gate

The same package over the same fixtures produces byte-identical policy outputs
across storage adapters (filesystem vs. optional Postgres) and across replays,
where adapters are not supposed to differ. Required parity fixtures:

- healthy responsibility stays quiet
- drifting responsibility schedules fulfillment
- down responsibility escalates after budget exhaustion
- blocked responsibility requests human review or escalation
- forecast pulls judge earlier
- hysteresis prevents flip-flop
- duplicate webhook does not duplicate pressure
- stale status is rejected or fenced
- contract revision change fences old decisions
- **policy recompile produces a byte-identical registry from identical history**
- **memoized verdict reuse spends zero judge tokens**

Required CI, not a best-effort script.

#### 3. Complete The Local Harness As A Public Product Surface

- clear `prose serve` startup logs for active responsibilities and triggers
- `prose status` view of latest status, Reactor decision, forecast, pending
  pressure, scheduled judge, **and per-token surprise attribution**
- deterministic local state layout docs
- example repositories runnable from a fresh clone
- local failure messages explaining missing tools, missing IDs, invalid status,
  stale claims, malformed decisions, **and undecidable contracts**
- a first-class **export/exit** surface (the contract and its trail leave
  cleanly — invariant 8, Tenet 6)
- release preflight that checks examples, package imports, and docs

The public developer should run one example and immediately understand why this
is not just cron plus prompt — ideally by watching token spend stay flat while
nothing changes.

#### 4. Harden Receipts And Projections

- content-addressed judge and decision receipts
- local receipt inspection
- a receipt proof surface for inspection and verification
- owner/subscriber/public projection contracts
- privacy tests that inject secrets and PII into judge rationale and prove they
  do not leak to public views (tiered projection is enforced here)
- event payloads that use real receipt hashes, not signature placeholders
- null-signer is the default and explicit; cryptographic signing is an
  optional pluggable signer adapter for cross-trust-domain non-repudiation
- receipts carry `as_of` and `next_forecast_recheck`; dependency edges pin
  contract revision and acceptable signer set (composition supply-chain safety)
- token-truth fields finalized after provider research (open item I.1)

### Required Evaluation Suite

A research instrument, not only a test suite.

#### Existing Evals To Keep

package unit; runtime loop; storage adapter; judge protocol; CLI repository IR;
CLI serve and status; status and pressure; package bridge; release preflight;
package pin verification; negative architecture tests.

#### Novel Reactor Evals To Add

| Eval                             | Question                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reconciliation correctness       | Does the Reactor choose the oracle next action from event, status, history, budget?                                                                    |
| Forecast quality                 | Does forecast scheduling catch likely drift earlier without excessive checks?                                                                          |
| Oscillation resistance           | Does hysteresis avoid flip-flopping under noisy judge outputs?                                                                                         |
| Duplicate event idempotency      | Do repeated webhooks/queue/timer ticks produce one action?                                                                                             |
| Crash recovery                   | Does restart converge after status, decision, or pressure-dispatch interruption?                                                                       |
| Capability blocking              | Does missing tool/connector state become `blocked`, not hallucinated success?                                                                          |
| Privacy projection               | Do secrets, emails, private URLs, customer payloads stay out of public views?                                                                          |
| Contract revision fencing        | Do old decisions stop applying after source changes?                                                                                                   |
| Long-horizon maintenance         | Does state hold over simulated 7, 30, 90 day timelines?                                                                                                |
| Adversarial evidence             | Does conflicting/malicious evidence reduce confidence or escalate?                                                                                     |
| **Cost scales with surprise**    | Can every token be attributed to a surprise-cause; does spend stay flat under no change?                                                               |
| **Variable-depth correctness**   | Does the judge escalate depth only when uncertain/high-stakes, and downgrade when confident?                                                           |
| **Policy recompile correctness** | Does the model-authored policy recompile on policy drift, and does the meta-loop stay stable (no recompile thrash, rollback to last-known-good works)? |
| **Composition propagation**      | Does a dependent re-judge only when an upstream receipt changes; does cost amortize across N dependents?                                               |
| **Supply-chain pinning**         | Does a dependent reject an upstream receipt whose contract revision or signer is not pinned?                                                           |
| **Calibration anchor**           | Does scoring the ensemble against bring-your-own-correctness-truth measurably reduce ensemble bias?                                                    |
| **Undecidable contract**         | Does the judge emit an undecidable diagnosis on an unjudgeable contract, routed to the author?                                                         |
| Human-review boundary            | Does the runtime ask for review when autonomy would be unsafe?                                                                                         |

Each eval emits machine-readable results and a human-readable report.

#### Baselines

- naive single-agent loop
- cron-only judge and fulfillment loop
- workflow DAG with retries but no Reactor
- model-interpreted Reactor doctrine without package policy
- Reactor without forecast
- Reactor without hysteresis
- Reactor without receipts
- Reactor without durable pressure claims
- **Reactor without memoization (cost scales with time)**
- **Reactor without variable-depth judging (fixed ensemble)**
- **Reactor without policy recompile (fixed policy)**
- **Reactor without composition (islands)**

The best result is precise, not triumphal:

```text
Forecast improves freshness in event-sparse domains.
Memoization makes cost scale with surprise, not time.
Variable-depth judging preserves accuracy at lower cost.
Hysteresis reduces unnecessary fulfillment under noisy judgment.
Durable decisions and claims improve crash recovery and idempotency.
Receipts improve auditability without changing task quality.
Composition amortizes cost across dependents.
Model choice changes judge accuracy more than Reactor correctness.
```

### Model Matrix

Target families: Anthropic, OpenAI, Gemini, Grok. Test premium and cheaper
models. The point is model fit by role, not leaderboard quality.

| Role        | What To Measure                                                             |
| ----------- | --------------------------------------------------------------------------- |
| Judge       | status accuracy, evidence quality, calibration, blocked correctness         |
| Fulfillment | restoration rate, overreach rate, output quality, cost                      |
| Summarizer  | projection safety, concision, evidence preservation                         |
| End-to-end  | convergence rate, cycles to restoration, cost per maintained responsibility |

Metrics: status accuracy and F1; Brier/calibration error for confidence; action
optimality vs oracle Reactor decisions; convergence rate; duplicate action
rate; escalation correctness; privacy leak rate; cost per maintained
responsibility; **fraction of tokens attributable to a surprise-cause**;
latency to restoration; receipt completeness; human review pass rate.

Questions: which models are best judges; best fulfillers; which cheaper models
safely replace expensive ones after confidence is high; where the Reactor
compensates for weaker models; where model quality still dominates; **where
ensemble disagreement is a well-calibrated uncertainty signal**.

The matrix runs through **both** seams — the bounded-activation agent-session
adapter and the model-gateway socket — so the adapter boundary stays honest
permanently and the policy-author migration path is exercised, not assumed.

### Public Case Studies

1. release readiness
2. incident briefing room
3. customer risk radar
4. compliance evidence tracker
5. vendor renewal watch
6. research inbox triage
7. content performance loop

Each includes: source responsibility and gateway contracts; synthetic or
sanitized event stream; expected oracle status trajectory; model outputs;
Reactor decisions; forecasts; pressure records; receipts; final projections;
cost and latency summary (including surprise attribution); baseline comparison.
Runnable from the CLI.

### Technical Report Outline

Written after the evals, not before.

1. **Problem**: AI agents are bad at long-lived responsibility maintenance.
2. **Category**: Definition of Reactor-class harnesses.
3. **Prior Patterns**: React reconciliation (lead), control systems (time/cost
   dimension), with event sourcing, dataflow, controllers, workflow engines,
   CQRS / read models, and actor systems as footnoted lineage.
4. **OpenProse Design**: lived loop; the unification thesis; two-timescale
   policy; variable-depth judging; forecast-gated quiescence; composition;
   receipts; projections; adapters.
5. **Implementation**: `@openprose/reactor`, CLI/server, storage,
   optional signing, cross-adapter/replay parity.
6. **Evaluation Methodology**: fixtures, domains, baselines, metrics, model
   matrix.
7. **Results**: cost-scales-with-surprise, model differences, ablations,
   convergence, latency, idempotency, crash recovery, privacy.
8. **Case Studies**: selected responsibilities and timelines.
9. **Limitations**: connector coverage, judge reliability, prompt sensitivity,
   public receipt maturity, cost curves, human review, open items I.1–I.6.
10. **Future Work**: learned forecast policies, automatic model routing,
    deeper dependency-graph amortization. (A public responsibility market is
    out of scope of this specification.)

Sober. Make a strong claim, then show the evidence and the limits.

### Definition Of Done For Launch

- `@openprose/reactor` is public, pinned, and verified.
- The CLI release imports the package and passes release preflight from a clean
  install.
- Backend and CLI parity fixtures are required CI, including policy-recompile
  and memoization parity.
- At least five public examples run locally from a fresh clone.
- The eval suite includes conventional tests, Reactor evals (including
  cost-scales-with-surprise, variable depth, policy recompile, composition),
  baselines, and model matrix results.
- The technical report includes measured results, not only architectural prose.
- Receipts and projections are honest about the null-signer default vs. an
  optional signer adapter; export/exit works.
- Public examples avoid leaking private or sensitive evidence.
- The docs define when to use a Reactor-class harness and when not to.
- Open items I.1–I.6 are either closed or explicitly scoped as future work.
- A technically skeptical reader can reproduce enough of the claim to trust it.

The release sentence:

> OpenProse is a Reactor-class harness for maintaining AI-authored
> responsibilities over time: it reconciles declarative goals against events,
> durable observations, forecasts, typed decisions, and auditable receipts —
> and its cost scales with surprise, not time.

That is a category worth naming.
