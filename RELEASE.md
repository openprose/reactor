# Reactor Release Process

Reactor is experimental (alpha): releases are plain semver `0.x` versions on
the `latest` dist-tag, with no prerelease suffix or `alpha` tag — `0.x` already
says anything may change. The three publishable packages (`@openprose/reactor`,
`@openprose/reactor-cli`, `@openprose/reactor-devtools`) each version
independently and publish together on one `reactor-v*` tag;
`@openprose/reactor-evals` is private and never publishes.

There is no bump script for this train — versions are edited by hand.

## 1. Bump the versions

Edit `version` in each package that changed (a dependent bumps even when only
its SDK dependency moved, so consumers pick up the new `^` floor):

- `packages/reactor/package.json`
- `packages/reactor-cli/package.json`
- `packages/reactor-devtools/package.json`

`workspace:^` dependencies are rewritten to the concrete SDK version at pack
time, so nothing else needs editing.

## 2. Record the release in `CHANGELOG.md`

Move the `[Unreleased]` entries under a new section whose header carries all
three versions — this exact grammar is what `scripts/extract-changelog.sh`
matches later:

```markdown
## [reactor X.Y.Z / reactor-cli A.B.C / reactor-devtools D.E.F] - YYYY-MM-DD
```

## 3. Open the PR and let CI pass

The `CI - Reactor Package` job runs the offline gate: signature audit, build,
package tests, the example replay suites, the eval-harness checker, and a
`pnpm pack` of each publishable package. Merge to `main` once it is green.

## 4. Tag

Tags carry the SDK version and, when the CLI moved, its version too:

```bash
git tag -a "reactor-vX.Y.Z-cli.A.B.C" -m "reactor X.Y.Z / reactor-cli A.B.C / reactor-devtools D.E.F"
git push origin "reactor-vX.Y.Z-cli.A.B.C"
```

## 5. Publish happens in CI

The tag push runs `.github/workflows/ci.yml` again; after the `ci` job passes,
the `publish` job packs each package with `pnpm pack` and runs `npm publish
--provenance` through **OIDC trusted publishing** — no `NPM_TOKEN` exists in the
repository. Each package is registered on npmjs.com as a trusted publisher
bound to this repository and this workflow file; provenance requires
`repository.url` in each `package.json` to match, so it must stay
`git+https://github.com/openprose/reactor.git`.

Already-published versions are skipped, so re-running the job after a partial
failure is safe. The SDK publishes first; the CLI and devtools follow.

Confirm from any machine:

```bash
npm view @openprose/reactor@X.Y.Z repository.url dist.attestations
```

## 6. Create the GitHub Release

CI never creates a Release. Once npm confirms, cut it by hand with the
changelog section as its notes:

```bash
gh release create "reactor-vX.Y.Z-cli.A.B.C" \
  --title "reactor X.Y.Z / reactor-cli A.B.C / reactor-devtools D.E.F" \
  --notes-file <(./scripts/extract-changelog.sh "reactor X.Y.Z / reactor-cli A.B.C / reactor-devtools D.E.F")
```

Releases up to 0.3.2 were published from `openprose/prose` and stay there; this
repository's release history starts at 0.3.3.

## Bumping the pinned skill snapshot

`skills/open-prose/` is a pinned snapshot of the OpenProse skill (see
[`skills/README.md`](skills/README.md)); it is never tracked live. To move it to
a newer skill, do it as its own reviewed change, then release:

1. Replace the tree from the target commit of `openprose/prose`:

   ```bash
   git rm -rq skills/open-prose
   git -C ../prose archive <sha> skills/open-prose | tar -x
   git add -f skills/open-prose
   ```

2. Update the commit, skill version, and `runtime_contract` recorded in
   `skills/README.md`.

3. Run the full offline gate (`pnpm build && pnpm test:reactor:offline && pnpm
   test:examples`) — the example replay kits under
   `skills/open-prose/examples/` and the SDK's render tests are what prove the
   harness against the new skill. Fix or record any drift before merging.

4. Note the new pin under `[Unreleased]` in `CHANGELOG.md`; it ships with the
   next tag, since the SDK tarball bundles the snapshot at pack time.
