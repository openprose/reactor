# Changelog

All notable changes to Reactor — `@openprose/reactor`, `@openprose/reactor-cli`,
and `@openprose/reactor-devtools` — are documented in this file. Each package
versions independently; a release section names all three.

Releases up to 0.3.2 were cut from [`openprose/prose`](https://github.com/openprose/prose),
whose `CHANGELOG.md` carries the same reactor-train sections; from 0.3.3 they are
cut here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `reactor serve` no longer takes every hosted reactor down when one reactor's
  continuity poll, gateway poll or shutdown rejects: the host settles every
  reactor before handling failures, the failing reactor is reported (`reactor
  <name>: poll failed: <message>`, with the categorized error event sampled once
  per reactor), and the other reactors keep being served. `bootHost` gains an
  `onReactorError` handler; without one the first failure is still rethrown, but
  only once every reactor has settled.

## [reactor 0.3.3 / reactor-cli 0.2.4 / reactor-devtools 0.3.1] - 2026-08-24

Metadata release from the standalone repository. No runtime changes.

### Changed

- Repository moved to github.com/openprose/reactor; Reactor is experimental
  (alpha) — early software, no stability guarantees. Each package's `repository`
  field and description say so, and the npm provenance for this release is bound
  to the new repository.
- The bundled open-prose skill is a pinned snapshot of skill 0.15.0
  (`openprose/prose` @ `779138a6`), vendored at `skills/open-prose/` and bumped
  deliberately per `RELEASE.md`, never tracked live.

## [reactor 0.3.2 / reactor-cli 0.2.3 / reactor-devtools 0.3.0] - 2026-08-12

Reactor-train release (`reactor-v*` tag train). Each package publishes at its own
version; the skill/plugin track is unaffected.

_Recorded retroactively: the `### Added` entries and the temperature / `reactor
trigger` entries below shipped in this release (#137, #138, 2026-06-13) but were
still filed under `[Unreleased]` when it was tagged._

### Added

- **`model.reasoning_effort` (`reactor.yml`) / `reasoningEffort` (SDK render and
  compile options).** Passed verbatim into `modelSettings.reasoning.effort` —
  values are model-dependent and validated by the provider. OpenAI reasoning
  models accept a custom temperature only when effort is `none`, so this keeps
  deterministic setups expressible on those models
  (`temperature: 0` + `reasoning_effort: none`).
- **A failed render now records why it failed, and every command surfaces it.**
  The reason is persisted on the `failed` receipt (inside its `semantic_diff`,
  so no receipt field or schema changed and existing `.reactor/` ledgers keep
  verifying) and shown by `reactor run`, `reactor trigger`, `reactor logs`,
  `reactor trace`, and `reactor inspect`. API keys and other secret material in
  a reason are scrubbed before it is stored or printed. Previously a failed
  render surfaced only `failed`, with no way to learn the cause without editing
  the source.
- **`reactor serve` reports per-gateway poll activity in its heartbeat.** Each
  cycle now prints `gateways: <source> ingested=N skipped=M`, so a poll that
  stages nothing (an empty payload, or a backlog the cursor already deduped) is
  no longer indistinguishable from a healthy one. Hosts with no configured
  gateways print nothing new.

### Changed

- **`@openprose/reactor-devtools` 0.3.0 — the replay viewer is re-skinned** to the
  OpenProse machine surface (charcoal + gold, JetBrains Mono) and gains the
  credibility-seam panels (version/reuse/footprint/skew).
- **An unset `temperature` is now omitted from model requests instead of
  silently becoming 0.** OpenAI reasoning models (gpt-5.5, the o-series) reject
  any explicit temperature, so "send no temperature" has to be representable:
  deleting the `temperature:` line from `reactor.yml` — or leaving the SDK's
  `RenderOptions.temperature` / `CompileSessionConfig.temperature` unset — now
  sends none, and the provider's default applies. Projects that relied on the
  implicit 0 should set `temperature: 0` explicitly (the `reactor init`
  scaffold already writes it). Type surface: `ModelConfig.temperature` is now
  optional, and `mergeModelSettings` omits the temperature key when none
  resolves.
- **`reactor trigger` now exits non-zero when a render fails or the configured
  provider is missing its key.** It previously returned `0` even when the
  triggered render failed, and a project configured for a non-default provider
  with only `OPENROUTER_API_KEY` present appeared to succeed by rendering
  through the wrong provider. `trigger` now fails fast with an actionable error
  naming the exact env var when a custom provider's key is absent, and exits `1`
  on any `failed` disposition — matching `reactor run`.

### Fixed

- **`@openprose/reactor-cli` 0.2.3 — reserved `@`-prefixed files no longer win the
  structured-backing pick (#136, #153).** A render that wrote both the reserved
  `@atomic.json` status file and its real structured backing (e.g. `sources.json`)
  had the status file chosen, because `@` sorts before lowercase letters. The
  canonicalizer then found none of the declared material paths and fingerprinted
  every facet as `sha256("null")`, so nothing propagated downstream. `@`-prefixed
  files are now excluded from the candidate set.
- **`@openprose/reactor-cli` 0.2.3 — `reactor.yml`'s provider and temperature are
  honored (#137, #138)**, an unset temperature is omitted rather than sent, and
  render failure reasons are surfaced instead of swallowed.
- **`@openprose/reactor` 0.3.2 — provider key material is scrubbed** from surfaced
  render errors.
- **`@openprose/reactor` 0.3.2 — height-ordered, dirty-count-gated reconciler drain
  (MK-1).** The FIFO drain could render a diamond-shaped dependent before all its
  parents settled, producing a transient glitch value and a redundant re-render.
- **`reactor.yml`'s `temperature` now governs run/serve renders, not only
  compile.** `run`, `serve`, and the multi-reactor host thread
  `model.temperature` / `model.reasoning_effort` into the render exactly like
  `render_model`; previously a configured temperature reached compile sessions
  while renders silently used the SDK default. `reactor doctor --live` no
  longer pins temperature 0 in its connectivity probe (it 400ed against
  reasoning render models), and the temperature-rejection 400 from a provider
  now maps to an actionable hint naming the `reactor.yml` line to fix.
- **`reactor trigger` now honors `reactor.yml`'s provider and model.** It
  threaded no provider, model, or decoding settings into the render, so a live
  trigger always fell back to the SDK's default OpenRouter provider and model
  regardless of configuration — and with only the configured provider's key
  present, every trigger produced a bare, causeless `failed` receipt
  (`model: "none"`, zero tokens). `trigger` now resolves the provider plan and
  threads `render_model`, `temperature`, and `reasoning_effort` into the render
  exactly like `run` and `serve`.
