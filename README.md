> **Experimental (alpha).** Reactor is early software: APIs, file formats, and CLI behaviour may change between
> releases, and there are no stability or compatibility guarantees — evaluate it on your own judgement. The language and Skill live at **[OpenProse](https://github.com/openprose/prose)**.

# Reactor — the deterministic harness for OpenProse

> **Declare the world as it should be; Reactor keeps it true.**

**Reactor (`@openprose/reactor`) is a deterministic runtime for [OpenProse](https://github.com/openprose/prose) contracts.** It holds a composed **world-model** (your declared truth, on disk), watches the world for change, and re-renders only the declared facets whose inputs actually moved (memoized agent sessions wired into a DAG). Every decision leaves a content-addressed **receipt** behind. The SDK lives at [`packages/reactor/`](packages/reactor/), with the full API reference in the **[SDK README](packages/reactor/README.md)**; the `reactor` binary ships from [`packages/reactor-cli/`](packages/reactor-cli/) and the keyless replay viewer from [`packages/reactor-devtools/`](packages/reactor-devtools/).

Reactor compiles a contract set once (intelligently: Forme topology, a per-node canonicalizer, postcondition validators, all frozen), then runs it forever (dumbly: compare fingerprints, skip / render / propagate). The reconciler that decides _whether to wake_ is deliberately deterministic: **there is no judge step.** The memo key has no clock in it. A failed render leaves the prior truth standing, and a `failed` receipt records why; only a rendered, moved fingerprint propagates. And because the reconciler acts only when reality drifts from what you declared, the bill follows real change, not the clock:

> **Inference cost that scales with surprise, not wall-clock time.**

> **Versions (live on npm):** `@openprose/reactor` 0.3.3 ·
> `@openprose/reactor-cli` 0.2.4 · `@openprose/reactor-devtools` 0.3.1. The `reactor` binary ships from the
> **`reactor-cli`** package, so `reactor --version` prints the CLI version (0.2.4), not the
> SDK version (0.3.3). Expected, not a mismatch.

**What "experimental (alpha)" means here.** The packages are published under their plain semver versions on `latest`, and this repository holds the complete source and history. Anything may change between releases — the SDK surface, the receipt and state-dir formats, CLI flags and exit codes — and there is no compatibility promise across versions yet. Read the receipts, run the keyless replay, and judge for yourself. Author your contracts with the OpenProse skill (`npx skills add openprose/prose`); this harness is one way to serve them.

- [Quickstart](#quickstart-60-seconds-no-model-key) · [The SDK](#the-sdk) · [The example library](#the-example-library) · [Operator guide](#operator-guide) · [Status and roadmap](#status-and-roadmap) · [Honest status](#honest-status-harness) · [Releases](#releases) · [Contributing](#contributing--releasing)

## Quickstart (60 seconds, no model key)

> **Onboarding an agent on behalf of a user?** Follow these four steps in order. The binary is **`reactor`**. Step 2 is the keyless proof (no key, no spend); steps 3 and 4 are scaffold-and-go. That's the whole path; the rest of this section is reference.

**1. Install.** All three packages are live on npm. The keyless step below needs no
install at all. Run it straight through `npx`:

```bash
# no install, run the keyless replay directly:
npx -p @openprose/reactor-devtools reactor-devtools --example masked-relay --describe
```

For the full CLI, prefer a project-local install (no root, no global collisions):

```bash
npm install @openprose/reactor @openprose/reactor-cli @openprose/reactor-devtools
# then call the binaries with `npx reactor …` / `npx reactor-devtools …`
```

> **Footprint:** the keyless replay above needs **no install**; the **SDK core**
> (`@openprose/reactor`) alone is zero-runtime-dependency; the **full quickstart** (CLI +
> devtools + the live-render peers `@openai/agents`/`zod`) pulls the agent/provider tree,
> on the order of **~99 MB / ~100 packages** (measured 2026-06-06).

> **Local install?** The bare `reactor …` / `reactor-devtools …` commands shown below assume the
> binaries are on your `PATH` (a global install). After the project-local `npm install` above,
> prepend `npx` to them, e.g. `npx reactor init my-project`, `npx reactor-devtools ./replay --describe`.
> (The keyless `npx -p @openprose/reactor-devtools …` lines already do this and need no change.)

<details><summary>Global install (alternative, collision- and EACCES-prone)</summary>

```bash
npm i -g @openprose/reactor @openprose/reactor-cli @openprose/reactor-devtools
```

A global `-g` can collide with other tools' binaries, and on Linux/WSL it may fail with
`EACCES`. Use a user prefix (nvm) or `sudo`, or just prefer the local install above.

**Air-gapped?** The _runtime_ is offline-clean, but the full quickstart `npm install` of all
three packages still reaches the registry once and pulls the CLI plus the live-render
agent/provider stack (`@openai/agents`, `zod`, and their transitive express/MCP/realtime tree),
on the order of **~99 MB / ~100 packages** (measured 2026-06-06). The **SDK core**
(`@openprose/reactor`) is genuinely zero-runtime-dependency, and the keyless replay / `doctor` /
`compile --check` paths need none of that tree afterward.

</details>

**2. See the thesis, keyless, no model call.** Replay a saved sample run (synthetic, illustrative tokens) and read the per-node `rendered`/`skipped` dispositions, the receipt counts by `surprise_cause`, the token **cost rollup**, and per-node chain-verify:

```bash
npx -p @openprose/reactor-devtools reactor-devtools --example masked-relay --describe
```

```
dispositions  rendered=46 · skipped=31 · failed=0
surprise-cause  external=8 · input=69   (a.k.a. wake-cause)   ← receipt COUNTS, 77 total

COST ROLLUP  (tokens)
  total       fresh=27180 tokens · reused=12840 tokens · reuse=32%
    external  receipts=  8 fresh=   1080 tokens reused=840 tokens
    input     receipts= 69 fresh=  26100 tokens reused=12000 tokens
CHAIN-VERIFY ok
```

The `surprise-cause` line counts _receipts_ by what woke them (8 external + 69 input = the 77 total receipts); the **cost rollup** below it is the actual token spend: `fresh` tokens are what each surprise cost, `reused` is what memoization saved (32% of the would-be tokens). That's "cost scales with surprise", checkable, with no key and no spend. Frames where a memo-skip happened show as `skipped moved[—] fresh 0`.

> **Prefer the browser?** Drop `--describe`: `reactor-devtools --example masked-relay` boots an
> animated DAG viewer at a localhost URL: nodes flash on render, dim-pulse on memo-skip, with a
> live cost meter.

**3. Scaffold and inspect, keyless.** Everything here runs offline:

```bash
# local install? prepend: npx reactor … (see the "Local install?" note above)
reactor init my-project && cd my-project
reactor doctor                          # what's present + the exact fix for anything missing
reactor compile --check; echo "exit=$?" # offline; exits 1 if the contract set is STALE (CI-wireable)
```

Author your OpenProse contracts as `*.prose.md` files under the scaffold's `src/`, a `kind: responsibility` per standing goal (its `### Maintains` / `### Requires` / `### Continuity`), optional gateways for ingress, optional functions for stateless helpers. `reactor compile` runs Forme over them.

**4. Go live (needs a model key).** These steps reach the model surface: set `OPENROUTER_API_KEY` and the two optional peers; a keyless reader can stop at step 3.

```bash
npm i -g @openai/agents zod          # the two optional live peers
reactor compile                      # Forme wires the DAG; freezes per-node canonicalizers
reactor serve --http 8080            # drive the scaffold's static gateway to a real receipt
reactor-devtools .reactor --describe # replay YOUR live run's ledger
```

> Use `reactor serve` (not `reactor run`) to drive a scaffold's **static** gateway: `serve`
> ingests its seeded items; `run` is for graphs whose connectors emit on their own.

## The SDK

Reactor is a real SDK you plug into your own stack, not a closed product. The public API is a **curated front door**: `import { reactor } from "@openprose/reactor"`. One call takes a directory of `.prose.md` contracts all the way to a booted, reconciling reactor and hands back **one typed `Reactor` handle**.

```ts
import { reactor } from "@openprose/reactor";

// Compile ./my-project, assemble a durable reactor over ./state, boot to a fixpoint
// (cold nodes render once; warm nodes memo-skip), hand back a live handle.
const { reactor: r } = await reactor("./my-project", { directory: "./state" });

console.log(r.ledger.all().length); // the receipt trail
await r.ingest("source", { wake: { source: "external", refs: [] } });
```

That's the front door. The deeper surface lives behind six reasoned subpaths: `.` (the facade + the vocabulary a driver needs), `/agents` (the full `@openai/agents` escape hatch, every render knob passes through), `/adapters` (the substrate + record/replay injection seam), `/run` and `/run/types` (the offline boundary), and `/internals` (the engine room). The full API reference is the **[SDK README](packages/reactor/README.md)**; the adoption path from a bare install to a wired project is **[`ADOPTION.md`](packages/reactor/ADOPTION.md)**.

## The example library

The examples in [`skills/open-prose/examples/`](skills/open-prose/examples/) are the tour of the language: each carries its contract source and a README with its standing goal and DAG sketch. (That directory is a pinned snapshot of the OpenProse skill, bumped deliberately per [`RELEASE.md`](RELEASE.md); see [`skills/README.md`](skills/README.md).) The thirteen below are **replayable keyless**, driving the **real** reconciler at **zero model spend**, through two paths: the six marked with **\*** ship **bundled inside `reactor-devtools`** and replay **by name from any directory** (no clone needed), and the full thirteen are exercised by the offline example corpus at [`tests/open-prose/examples/`](tests/open-prose/examples/), six of which ship a committed, chain-verifiable `replay/` state-dir you can open directly. (Two of the thirteen, `masked-relay` and `tamper-forge`, share a **byte-identical** ledger: `tamper-forge` is an audit _lens_ over the masked-relay receipts, so the set is **twelve distinct datasets plus one honest tamper-evidence lens**, not thirteen unrelated ledgers.)

The per-example `generate.ts` files under [`tests/open-prose/examples/`](tests/open-prose/examples/) are the expansion path from the corpus's authored contracts to the described topologies: `src/` alone mounts only the contracts an example authors, and the node and edge counts the corpus READMEs state are what these generators produce.

| Example                   | What it shows                                                                   | Domain            |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------- |
| `surprise-cost` \*        | memoized skip → surprise-render when the memo key moves                         | the core thesis   |
| `renewal-risk`            | a standing responsibility re-checking only the accounts that moved              | SaaS / finance    |
| `inbox-triage` \*         | diamond fan-in + failure isolation                                              | email / ops       |
| `monorepo-ci` \*          | hub fan-out blast radius; a failing test blocks the merge gate                  | dev tooling / CI  |
| `research-tree` \*        | recursive propagation up a tree, branch-memoized                                | research          |
| `masked-relay` \*         | peer-blind fan-out with deterministic masked projections                        | competitive intel |
| `agent-observatory` \*    | many cheap watchers → batched synthesis                                         | agent ops         |
| `tamper-forge`            | attack a real ledger; watch chain-verify catch it (and where it honestly can't) | audit / security  |
| `oblique-weave`           | hidden-context adversarial roles                                                | product strategy  |
| `github-star-enricher`    | per-entity fan-out + shared receipts + a human gate                             | growth / GTM      |
| `implementation-pipeline` | fixed wide fan-out with per-facet lane wake                                     | software delivery |
| `forme-fixpoint`          | the topology as a responsibility (the self-wiring bootstrap)                    | meta              |
| `basic-unit-suite`        | the 13 micro-mechanics, one by one                                              | substrate         |

**Run any starred example, keyless, from anywhere** (no clone, no install):

```bash
npx -p @openprose/reactor-devtools reactor-devtools --example surprise-cost --describe
```

**Or open a committed replay directly** (from a clone of this repo):

```bash
reactor-devtools tests/open-prose/examples/renewal-risk/replay --describe   # the render/skip/cost trail
reactor --state-dir tests/open-prose/examples/renewal-risk/replay receipts  # the per-node ledger (list | verify | cost)
```

> **Installed from npm, not a repo clone?** The skill and its example contracts ship inside the
> SDK tarball at `node_modules/@openprose/reactor/skill/open-prose/examples/<name>/` (note:
> `skill`, singular, in the tarball; `skills`, plural, in the repo), and the starred examples
> replay by name from any directory with the `--example` command above.

**Or run the offline example corpus** (this is what CI runs, zero spend):

```bash
REACTOR_OFFLINE=1 pnpm test:examples
```

To take one live, `cd` into its dir and run `reactor doctor → compile → topology → run → serve` with a key set. Each example's `README.md` carries its standing goal, DAG sketch, and the full flow.

## Operator guide

The install → `reactor.yml` → `compile → run → serve` lifecycle, the `prose react` playbook, and the keyless `reactor-devtools` replay are documented in the vendored skill's **[`skills/open-prose/reactor.md`](skills/open-prose/reactor.md)**. That file is pinned with the rest of the snapshot (skill 0.15.0) and describes exactly the surface this harness ships; the authoring model behind it is [`skills/open-prose/concepts/reactor.md`](skills/open-prose/concepts/reactor.md). The CLI's own reference, including every command and the telemetry policy, is the **[`reactor-cli` README](packages/reactor-cli/README.md)** and **[`TELEMETRY.md`](packages/reactor-cli/TELEMETRY.md)**.

## Status and roadmap

The harness specification is [`spec/02-ReactorHarness.md`](spec/02-ReactorHarness.md): Part I is the contract any conforming harness must satisfy (the reconcile loop, quiescence, the core invariants, the receipt schema), **Part II — "What Exists Today"** is the most accurate inventory of what this repository ships, and **Part III — "What Is Next"** is the roadmap. The authoring rules that map one-to-one onto those invariants are [`spec/03-ReactorPattern.md`](spec/03-ReactorPattern.md). The full architecture write-up (the React metaphor that _is_ the design, the Forme wiring, the receipt model, an honest RLM accounting) is the **[Reactor technical report](https://docs.prose.md/reactor)**. The preregistered SURPRISE-COST benchmark lives in [`packages/reactor-evals/`](packages/reactor-evals/).

## Honest status (harness)

In the spirit of the receipts:

- **Built and runnable:** the render atom, the content-addressed world-model store, the compiled canonicalizer with facets, Forme's wiring with diagnostics + acyclicity, postcondition-gated commits (no judge step), the chain-verifiable receipt ledger, and the forecast/continuity scheduler, all exercised by an offline test suite (no model calls in the commit gate) plus the 13 example gates.
- **Benchmarks are openly pending, on purpose.** We're publishing the harness before the numbers; we won't imply a measured speedup we haven't run. The proof you can check today is the keyless replay above.
- **Signer caveat:** in v1, _signed_ means tamper-evident at the meaning layer and chain-consistent, not yet a cryptographic byte hash. `reactor receipts verify` proves the receipt **chain** is consistent, but does not yet bind the world-model artifacts (editing a `world-models/*/published.json` while leaving `receipts.json` intact is not caught). The `tamper-forge` example demonstrates exactly this boundary. So the chain is tamper-_evident_ (it catches an independent edit) but not tamper-_proof_: a forge that re-stamps the **whole** trail with the public `computeReceiptContentHash` re-heals it. The cryptographic byte-hash signer that closes this (binding the published world-model to its receipt, making cross-boundary composition non-repudiable) is **tracked but not yet scheduled** (`C3` in the Reactor backlog).
- **No timestamp, no actor (yet):** a v1 receipt records _what_ changed and _why_ (fingerprints, wake cause, status, cost) but not _when_ it was committed or _who_ committed it, so the ledger is a verifiable record of decisions and their evidence, **not yet a substitute for an external audit log** that must answer "at what time, by which principal."
- The **fixpoint** (topology-as-responsibility) is specified and deferred; facet inference and ledger compaction are named roadmap.

This honesty is the point. The harness is young, should be used with caution, and has some way to go before it reaches its ideal form. The most useful thing you can hand us is a responsibility it _should_ keep and doesn't: a standing goal that breaks the surprise story, a wiring Forme gets wrong, a domain where this falls apart. The short guide to authoring an eval from the public SDK is **[`packages/reactor/EVALS.md`](packages/reactor/EVALS.md)** (shipped inside the SDK tarball too), and issues are welcome at [github.com/openprose/reactor/issues](https://github.com/openprose/reactor/issues).

## Releases

- **From 0.3.3 onward** (`@openprose/reactor` 0.3.3 · `reactor-cli` 0.2.4 · `reactor-devtools` 0.3.1): tagged, published, and attested from this repository. See [GitHub Releases](https://github.com/openprose/reactor/releases) and [`CHANGELOG.md`](CHANGELOG.md).
- **0.3.2 and earlier:** published from [`openprose/prose`](https://github.com/openprose/prose), where their tarballs, provenance attestations, and [Releases](https://github.com/openprose/prose/releases?q=reactor-v) remain. Their history is carried here intact, including the `reactor-v*` tags. Every release is a plain semver version on the `latest` dist-tag; `0.x` is the compatibility promise, which is to say none yet.

## Contributing / Releasing

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers setup, the offline test gate, and where changes belong; [`RELEASE.md`](RELEASE.md) documents the tag-driven npm release and how the pinned skill snapshot is bumped. [MIT License](LICENSE).

---

_The conversation always ends. The responsibility shouldn't have to._
