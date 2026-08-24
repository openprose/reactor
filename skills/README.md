# Vendored open-prose skill (frozen)

`skills/open-prose/` is a snapshot of the OpenProse skill, vendored from
[`openprose/prose`](https://github.com/openprose/prose) at commit
`779138a615e84c93146dcbee962861feafbad307` — skill **0.15.0**,
`runtime_contract: 2`, the tag `skill-v0.15.0` and the `reactor-v0.3.2-cli.0.2.3`
release point. It is the version Reactor was validated against and the last one
that documents the `prose react` flow and the `reactor.md` operator guide.

It is **frozen on purpose.** Reactor is deprecated and on ice; the skill keeps
evolving in `openprose/prose`. Do not sync this tree forward: a newer skill may
route differently, and the harness has not been exercised against it.

## Why it is here

A render *is* the SKILL — the SDK reads `SKILL.md` as the system prompt of every
render session. Two code paths find it by walking up the directory tree for
`skills/open-prose/SKILL.md`, which is why the snapshot sits at this exact path:

- `packages/reactor/scripts/bundle-skill.mjs` copies it into the SDK tarball at
  pack time (`<pkg>/skill/open-prose/`), so a bare `npm i @openprose/reactor`
  carries its own render VM.
- `packages/reactor/src/adapters/agent-render/instructions.ts` resolves it at
  runtime as the third candidate, after `REACTOR_SKILL_PATH` and the bundled copy.

The three example directories that carry replay test kits
(`examples/{feedback-pulse,press-desk,support-inbox-router}`) have their own
history in this repository; the snapshot overlays them byte-for-byte.

## Pointing the harness at a newer skill

`REACTOR_SKILL_PATH=<dir or SKILL.md>` overrides the lookup. That is an
unvalidated configuration for a deprecated harness; use it knowingly.
