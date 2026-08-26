# Vendored open-prose skill (pinned)

`skills/open-prose/` is a snapshot of the OpenProse skill, vendored from
[`openprose/prose`](https://github.com/openprose/prose) at commit
`779138a615e84c93146dcbee962861feafbad307` — skill **0.15.0**,
`runtime_contract: 2`, the tag `skill-v0.15.0` and the `reactor-v0.3.2-cli.0.2.3`
release point. It is the version Reactor was validated against and the one that
documents the `prose react` flow and the `reactor.md` operator guide.

It is **pinned on purpose.** The skill keeps evolving in `openprose/prose`, and
a newer skill may route differently than the one the harness was exercised
against. The snapshot is never tracked live: it is bumped deliberately, as a
reviewed change with the harness re-run against it, following the steps in
[`RELEASE.md`](../RELEASE.md). Do not edit files under `skills/open-prose/`
directly — skill changes belong in `openprose/prose`.

## Why it is here

A render *is* the SKILL — the SDK reads `SKILL.md` as the system prompt of every
render session. Two code paths find it by walking up the directory tree for
`skills/open-prose/SKILL.md`, which is why the snapshot sits at this exact path:

- `packages/reactor/scripts/bundle-skill.mjs` copies it into the SDK tarball at
  pack time (`<pkg>/skill/open-prose/`), so a bare `npm i @openprose/reactor`
  carries its own render VM.
- `packages/reactor/src/adapters/agent-render/instructions.ts` resolves it at
  runtime as the third candidate, after `REACTOR_SKILL_PATH` and the bundled copy.

The snapshot omits one thing the source tree carried at that commit: the replay
test kits that sat inside `examples/{feedback-pulse,press-desk,support-inbox-router}`.
They are this harness's tests, not skill content, and live with the other example
suites under `tests/open-prose/examples/`.

## Pointing the harness at a newer skill

`REACTOR_SKILL_PATH=<dir or SKILL.md>` overrides the lookup. The harness has
not been validated against skills newer than the pinned one; use it knowingly.
