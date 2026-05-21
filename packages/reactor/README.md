# @openprose/reactor

`@openprose/reactor` is the local Reactor Harness runtime spine for OpenProse.
It models the parts of a responsibility loop that need to survive replay,
forking, evidence review, and package verification without changing OpenProse
source syntax.

This README describes the `0.1.0-rc.1` package surface. It is an OSS release
candidate; the stable `0.1.0` launch waits for provenance publication and
stranger-run verification.

## v0.1 Status

What v0.1 demonstrates:

- The static-world cost thesis is visible in the package-backed
  `skills/open-prose/examples/flat-tokens` run: four `createReactor().ingest()` turns
  produce real Reactor receipts and print `tokens.fresh=46`,
  `tokens.reused=46`, and `ratio=46:46`.
- Receipts, owner/subscriber/public projections, and SDK export/import are
  implemented so the trail can be inspected, redacted for lower-trust readers,
  and carried as exit material.
- Composition pins verify consumed receipts against contract revision and
  acceptable signer posture; Cradle release parity exercises the same package
  surface across memory and filesystem rows, with Postgres marked future.
- Local examples are runnable from the package/CLI release surface: the flat
  tokens example runs from packed tarballs, and the companion OpenProse CLI
  quickstart compiles, serves, triggers, and projects an incident-briefing
  responsibility locally.

What is designed and partial:

- The CLI path is local and deterministic. It proves package/CLI integration,
  receipt production, and projection, not production ingress or hosted
  fulfillment quality.
- Provider parity is recorded, not a live runtime matrix. Cradle carries
  deterministic provider parity doubles and one live-recorded K1 cassette, but
  this package does not perform runtime variable-depth ensemble judging.
- The tagged publish gate is wired for provenance publication, but no npm
  publication has been run for this worktree.

Deferred to v0.2 or external gates:

- Actual npm publication and provenance until a release tag and npm auth or
  trusted publishing are available.
- The stranger run that verifies both local demos outside the authoring team.
- Production ingress, fulfillment, and oracle layers.
- Runtime variable-depth ensemble judging, Postgres parity, and a non-null
  signer adapter.

The runtime package currently provides:

- `openprose.receipt v0` creation, verification, canonical hashing, and proof
  inspection.
- Token-truth and surprise-attribution checks for flat-spend reasoning.
- Deterministic kernel policy evaluation, backstops, rollback comparison, and
  safety receipts.
- Compiled evidence-plan, memo-key, forecast, policy recompile/rollback, and
  graph-composition helpers.
- An adapter-injected SDK with receipt ingest, registry reads, and exit-bundle
  export/import.
- Owner/subscriber/public receipt projections for privacy-preserving evidence
  reports.

## Public Subpaths

The packed artifact exposes these CommonJS entrypoints:

- `@openprose/reactor`
- `@openprose/reactor/receipt`
- `@openprose/reactor/cost`
- `@openprose/reactor/kernel`
- `@openprose/reactor/evidence-plan`
- `@openprose/reactor/memo`
- `@openprose/reactor/forecast`
- `@openprose/reactor/sdk`
- `@openprose/reactor/policy`
- `@openprose/reactor/composition`
- `@openprose/reactor/projection`

## Quickstart

These TypeScript examples use the package's public subpaths. Verify a receipt
and derive a proof summary that avoids private payload fields:

```ts
import {
  inspectReceiptProofV0,
  verifyReceiptV0,
  type ReceiptV0,
} from "@openprose/reactor/receipt";

export function inspectStoredReceipt(receipt: ReceiptV0) {
  const verification = verifyReceiptV0(receipt);
  if (!verification.ok) {
    throw new Error(verification.errors.join("; "));
  }

  return inspectReceiptProofV0(receipt);
}
```

Project a proof for a lower-trust audience:

```ts
import { projectReceiptProofV0 } from "@openprose/reactor/projection";
import type { ReceiptProofInspectionV0 } from "@openprose/reactor/receipt";

export function publicReceiptEvidence(proof: ReceiptProofInspectionV0) {
  const result = projectReceiptProofV0({ tier: "public", proof });
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }

  return result.projection;
}
```

Create an SDK instance with explicit adapters. The SDK does not install hidden
network, model, agent, sandbox, or storage defaults. In v0.1, omitting `signer`
is represented explicitly as the null signer state
`{ scheme: "none", null_reason: "no-signer-adapter-configured" }`; real signing
adapters are deferred:

```ts
import { createReactor, type ReactorAdaptersV0 } from "@openprose/reactor/sdk";

const adapters: ReactorAdaptersV0 = {
  clock: { now: () => "2026-05-19T00:00:00Z" },
  storage: {
    appendReceipt: () => undefined,
    listReceipts: () => [],
    readRegistry: () => ({
      contract_revision:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      policy_artifact_id: "policy.incident-briefing",
      policy_artifact_identity: "incident-briefing",
      policy_artifact_namespace: "policy.static",
      policy_artifact_revision: "policy-revision-1",
      policy_artifact_validation_state: "validated",
    }),
  },
  modelGateway: { invoke: (request) => ({ payload: request.payload }) },
  agentSdk: { launch: (request) => ({ payload: request.payload }) },
  sandbox: { run: () => ({ exit_code: 0, stdout: "", stderr: "" }) },
  connectors: { read: () => ({ payload: null }) },
  eventSink: { emit: () => undefined },
};

const reactor = createReactor({
  responsibility_id: "responsibility.incident-briefing",
  adapters,
});

reactor.ingest({ kind: "tick" });
const exitBundle = reactor.export();
```

Evaluate a validated policy artifact before running B3 backstops:

```ts
import {
  evaluateBackstops,
  judgedActivations,
  validateKernelPolicyArtifact,
} from "@openprose/reactor/kernel";

const validation = validateKernelPolicyArtifact({
  no_anchor: true,
  falsification_predicate: {
    kind: "equals",
    fact: "material_status",
    value: "stale",
  },
  backstop_divergence_predicate: {
    kind: "greater-than-or-equal",
    fact: "observed_divergence_multiplier",
    value: 2,
  },
  live_observables: ["material_status", "observed_divergence_multiplier"],
});

if (!validation.ok) {
  throw new Error(validation.errors.join("; "));
}

const backstops = evaluateBackstops({
  token: validation.token,
  as_of: "2026-05-19T00:00:00Z",
  last_policy_revalidated_at: "2026-05-01T00:00:00Z",
  last_recompile_at: "2026-05-18T00:00:00Z",
  recompile_requested: false,
  policy_warmup_judged_activations: judgedActivations(1),
});
```

## Local Package Evidence

The current build has local evidence for the package shape:

```sh
pnpm --filter @openprose/reactor test
pnpm --dir packages/reactor pack --pack-destination /tmp/openprose-reactor-pack
node .github/scripts/verify-reactor-pin.mjs \
  --tarball /tmp/openprose-reactor-pack/openprose-reactor-0.1.0-rc.1.tgz
node .github/scripts/smoke-reactor-tarball-import.mjs \
  --tarball /tmp/openprose-reactor-pack/openprose-reactor-0.1.0-rc.1.tgz
pnpm --dir packages/reactor-cradle pack --pack-destination /tmp/openprose-reactor-pack
node .github/scripts/smoke-reactor-flat-tokens-example.mjs \
  --reactorTarball /tmp/openprose-reactor-pack/openprose-reactor-0.1.0-rc.1.tgz \
  --cradleTarball /tmp/openprose-reactor-pack/openprose-reactor-cradle-0.1.0-rc.1.tgz \
  --exampleDir skills/open-prose/examples/flat-tokens
```

The verifier checks the packed tree against the Cradle pin, and the import
smoke imports every public Reactor entrypoint from the tarball in a temporary
offline consumer. The flat-tokens smoke installs packed Reactor and Cradle
artifacts into a temporary offline consumer and expects `tokens.fresh=46`,
`tokens.reused=46`, and `ratio=46:46`.

## Current Boundaries

- This README describes the release-candidate package surface; the stable npm
  release waits for registry-visible provenance and stranger-run evidence.
- GitHub Actions contain a tagged publish gate that relies on npm trusted
  publishing/OIDC and rejects tag/package-version mismatches.
- The package does not include the CLI implementation; local CLI
  `serve/status` evidence lives in the companion OpenProse CLI worktree.
- Postgres parity, production adapter release, live provider/model matrix, and
  deployment checks are still outside this package surface.
- `cost.provider_norm` remains the deferred receipt v0 normalization field.
