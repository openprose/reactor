# Contributing to Reactor

Reactor is **experimental (alpha)**: early software with no stability or
compatibility guarantees, so a change that moves an API, a file format, or a
CLI behaviour is acceptable when it is the right call — say so in the PR and
record it in `CHANGELOG.md`. Language-level changes belong in
**[OpenProse](https://github.com/openprose/prose)** — the language and Skill —
not here.

## Layout

Reactor is the SDK + CLI + devtools harness that compiles and runs OpenProse
Responsibilities. It lives in a **pnpm workspace** under `packages/reactor`
(`@openprose/reactor`, the SDK), `packages/reactor-cli` (the `reactor` binary),
`packages/reactor-devtools` (the keyless replay viewer), and the private
`packages/reactor-evals` (the SURPRISE-COST benchmark). Note this is `pnpm` and
per-package scripts.

Around them sit the deterministic example corpus (`tests/open-prose/examples/`,
which replays committed state-dirs through the real reconciler), the
eval-harness checker (`tools/eval-harness/`), the harness spec (`spec/`), and a
pinned snapshot of the OpenProse skill (`skills/open-prose/`, see
[`skills/README.md`](skills/README.md)) that the SDK bundles and renders with.

## Setup and build

From the repo root:

```bash
pnpm install --frozen-lockfile        # install the workspace (pnpm 10.34.5 is pinned)
pnpm build                            # build reactor, reactor-cli, reactor-devtools in order
pnpm -C packages/reactor build        # or build a single package
pnpm -C packages/reactor test         # test a single package
```

The root `pnpm build` must run before the example suites: `vitest.config.ts`
aliases `@openprose/reactor` to `packages/reactor/dist`, the same bytes a
consumer imports.

## Use the offline gate as your default test command

The plain `pnpm test` includes **LIVE** tests that reach the model provider —
they go red without an OpenRouter key, or on a `402 Insufficient credits`, even
when your change is correct. The contributor default is the **offline** gate,
which runs no model calls and is exactly what CI runs:

```bash
pnpm test:reactor:offline             # the three packages, REACTOR_OFFLINE=1
pnpm test:examples                    # the 13 example replay suites + eval-harness checker
pnpm -C packages/reactor test:offline # or: REACTOR_OFFLINE=1 pnpm -C packages/reactor test
```

`REACTOR_OFFLINE=1` short-circuits key resolution (including the `.env` file
fallback), disables telemetry egress, and passing-skips every `*.live.test.ts`.
The LIVE tests are gated on a funded key and are not expected to pass in a
keyless or out-of-credits environment. State in your PR which gate you ran.

## Testing expectations

| Change type | Expected checks |
| --- | --- |
| SDK or harness behavior | `pnpm --filter @openprose/reactor test:offline`, or the narrow affected test file |
| CLI behavior | `pnpm --filter @openprose/reactor-cli test:offline` |
| Example fixtures or replay state | `pnpm test:examples`; regenerate with the example's `generate.ts` and commit the result |
| Docs-only copy | `git diff --check` and a read-through for current command names |

Every PR should say how it was tested. Prefer the narrowest check that can
fail again when the behavior regresses. Do not edit `skills/open-prose/`: it is
a pinned snapshot, bumped deliberately per [`RELEASE.md`](RELEASE.md), and
changes to the skill belong in `openprose/prose`.

## Releasing

See [`RELEASE.md`](RELEASE.md).

## Questions

- GitHub Issues: [github.com/openprose/reactor/issues](https://github.com/openprose/reactor/issues)
