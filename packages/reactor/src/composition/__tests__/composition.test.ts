import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import * as rootSurface from "../../index";
import {
  createComposedReceiptFreshnessV0,
  dependencyReceiptPinFromVerifiedReceiptV0,
  computeDownstreamComposedMemoKeyV0,
  evaluateTransitiveFreshnessV0,
  planCompositionPropagationV0,
  verifyUpstreamReceiptDependencyPinV0,
} from "../index";
import {
  InMemoryMemoStoreV0,
  type MemoizedVerdictV0,
  type MemoLookupResultV0,
  type PolicyArtifactMemoNamespaceV0,
  createMemoizedVerdictEntryV0,
} from "../../memo";
import {
  type ConsumedReceiptPinV0,
  type ContentHashV0,
  type ReceiptEventCauseV0,
  type ReceiptFreshnessV0,
  type ReceiptV0,
  type ReceiptV0Input,
  createReceiptV0,
  readTokenTruthV0,
} from "../../receipt";

const A_CONTRACT =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const B_CONTRACT =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const C_CONTRACT =
  "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as const;
const D_CONTRACT =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as const;
const A_EVIDENCE_V1 =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const A_EVIDENCE_V2 =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const B_EVIDENCE =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
const C_EVIDENCE =
  "sha256:9999999999999999999999999999999999999999999999999999999999999999" as const;
const D_EVIDENCE =
  "sha256:8888888888888888888888888888888888888888888888888888888888888888" as const;
const NAMESPACE = {
  policy_artifact_namespace: "policy.composition-fixture",
  policy_artifact_revision: "v0",
} as const;

test("composition public surface is exported from root and package subpath", () => {
  const packageJson = readPackageJson();

  equal(typeof rootSurface.computeDownstreamComposedMemoKeyV0, "function");
  equal(typeof rootSurface.createComposedReceiptFreshnessV0, "function");
  equal(typeof rootSurface.evaluateTransitiveFreshnessV0, "function");
  equal(typeof rootSurface.planCompositionPropagationV0, "function");
  equal(typeof rootSurface.verifyUpstreamReceiptDependencyPinV0, "function");
  deepEqual(packageJson.exports?.["./composition"], {
    types: "./dist/composition/index.d.ts",
    default: "./dist/composition/index.js",
  });
});

test("A's new receipt changes B's composed memo key through the dependency pin", () => {
  const upstreamV1 = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-v1",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 11, reused: 0 },
  });
  const upstreamV2 = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-v2",
    evidenceInputIds: [A_EVIDENCE_V2],
    tokens: { fresh: 13, reused: 0 },
  });
  const dependencyV1 = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstreamV1,
    acceptable_signer_set: ["none"],
  });
  const dependencyV2 = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstreamV2,
    acceptable_signer_set: ["none"],
  });

  const memoKeyV1 = computeDownstreamComposedMemoKeyV0({
    contract_revision: B_CONTRACT,
    evidence_receipts: [B_EVIDENCE],
    dependency_receipts: [dependencyV1],
  });
  const memoKeyV2 = computeDownstreamComposedMemoKeyV0({
    contract_revision: B_CONTRACT,
    evidence_receipts: [B_EVIDENCE],
    dependency_receipts: [dependencyV2],
  });

  equal(dependencyV1.upstream_content_hash, upstreamV1.content_hash);
  equal(dependencyV1.contract_revision, A_CONTRACT);
  deepEqual(dependencyV1.acceptable_signer_set, ["none"]);
  notEqual(upstreamV1.content_hash, upstreamV2.content_hash);
  notEqual(memoKeyV1, memoKeyV2);
});

test("upstream receipt dependency pin verification fails closed on supply-chain mismatches", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const expectedPin = {
    upstream_content_hash: upstream.content_hash,
    contract_revision: A_CONTRACT,
    acceptable_signer_set: ["none"],
  } satisfies ConsumedReceiptPinV0;

  const verified = verifyUpstreamReceiptDependencyPinV0({
    upstream_receipt: upstream,
    expected_dependency_pin: expectedPin,
  });
  equal(verified.receipt, upstream);
  equal(verified.content_hash, upstream.content_hash);
  equal(verified.signer_posture, "none");
  deepEqual(verified.dependency_pin, expectedPin);

  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          upstream_content_hash: A_EVIDENCE_V2,
        },
      }),
    "upstream receipt content hash must match dependency pin",
  );
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          contract_revision: B_CONTRACT,
        },
      }),
    "upstream receipt contract revision must match dependency pin",
  );
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: ["adapter.signer"],
        },
      }),
    "upstream receipt signer posture is not allowed by dependency pin",
  );
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: [],
        },
      }),
    "expected_dependency_pin.acceptable_signer_set must not be empty",
  );
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: ["none", "none"],
        },
      }),
    "expected_dependency_pin.acceptable_signer_set contains duplicate signer none",
  );
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: ["none", ""],
        },
      }),
    "expected_dependency_pin.acceptable_signer_set contains an empty signer",
  );
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstream,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: "none",
        },
      }),
    "expected_dependency_pin.acceptable_signer_set must be an array",
  );

  const invalidReceipt = {
    ...upstream,
    core: {
      ...upstream.core,
      memo_key: "memo-A-after-tamper",
    },
  };
  assertThrows(
    () =>
      verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: invalidReceipt,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: [],
        },
      }),
    "upstream receipt must verify before dependency pin check",
  );
});

test("transitive freshness evaluation marks fresh consumed receipts fresh", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });

  const evaluation = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-18T13:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    consumed_receipts: [
      {
        upstream_receipt: upstream,
        dependency_pin: dependency,
      },
    ],
  });

  equal(evaluation.outcome, "fresh");
  equal(evaluation.as_of, "2026-05-18T13:00:00Z");
  equal(
    evaluation.transitive_freshness_policy_ref,
    "policy.transitive-freshness@v0",
  );
  deepEqual(evaluation.stale_receipt_hashes, []);
  deepEqual(evaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: upstream.content_hash,
      next_forecast_recheck: "2026-05-19T12:00:00Z",
      staleness_outcome: "fresh",
    },
  ]);
});

test("transitive freshness evaluation honors stricter authored minimum freshness", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-authored-freshness",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
    freshnessNextForecastRecheck: "2026-05-19T12:00:00Z",
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });

  const kernelDefault = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-19T06:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@kernel",
    transitive_freshness_function: { kind: "kernel-default" },
    consumed_receipts: [
      {
        upstream_receipt: upstream,
        dependency_pin: dependency,
      },
    ],
  });
  const strictMinimumRemaining = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-19T06:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@strict",
    transitive_freshness_function: {
      kind: "minimum-remaining-freshness-ms",
      minimum_remaining_ms: 8 * 60 * 60 * 1000,
    },
    consumed_receipts: [
      {
        upstream_receipt: upstream,
        dependency_pin: dependency,
      },
    ],
  });

  equal(kernelDefault.outcome, "fresh");
  equal(strictMinimumRemaining.outcome, "stale-blocked");
  deepEqual(kernelDefault.stale_receipt_hashes, []);
  deepEqual(strictMinimumRemaining.stale_receipt_hashes, [upstream.content_hash]);
  equal(
    kernelDefault.consumed_freshness_evaluated[0]?.staleness_outcome,
    "fresh",
  );
  equal(
    strictMinimumRemaining.consumed_freshness_evaluated[0]?.staleness_outcome,
    "stale-blocked",
  );
});

test("transitive freshness evaluation stale-blocks at the forecast boundary", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-boundary",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });

  const evaluation = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-19T12:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    transitive_freshness_function: {
      kind: "minimum-remaining-freshness-ms",
      minimum_remaining_ms: 0,
    },
    consumed_receipts: [
      {
        upstream_receipt: upstream,
        dependency_pin: dependency,
      },
    ],
  });

  equal(evaluation.outcome, "stale-blocked");
  deepEqual(evaluation.stale_receipt_hashes, [upstream.content_hash]);
  deepEqual(evaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: upstream.content_hash,
      next_forecast_recheck: "2026-05-19T12:00:00Z",
      staleness_outcome: "stale-blocked",
    },
  ]);
});

test("transitive freshness evaluation records stale-refetched replacement receipts", () => {
  const staleUpstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-stale",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
    freshnessNextForecastRecheck: "2026-05-18T13:00:00Z",
  });
  const freshReplacement = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-refetched",
    evidenceInputIds: [A_EVIDENCE_V2],
    tokens: { fresh: 19, reused: 0 },
    freshnessNextForecastRecheck: "2026-05-19T13:00:00Z",
  });
  const staleDependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: staleUpstream,
    acceptable_signer_set: ["none"],
  });
  const freshDependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: freshReplacement,
    acceptable_signer_set: ["none"],
  });

  const evaluation = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-18T14:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    consumed_receipts: [
      {
        upstream_receipt: freshReplacement,
        dependency_pin: freshDependency,
        refetched_from_receipt: staleUpstream,
        refetched_from_dependency_pin: staleDependency,
      },
    ],
  });

  equal(evaluation.outcome, "fresh");
  deepEqual(evaluation.stale_receipt_hashes, []);
  deepEqual(evaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: freshReplacement.content_hash,
      next_forecast_recheck: "2026-05-19T13:00:00Z",
      staleness_outcome: "stale-refetched",
    },
  ]);

  assertThrows(
    () =>
      evaluateTransitiveFreshnessV0({
        as_of: "2026-05-18T12:00:00Z",
        transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
        consumed_receipts: [
          {
            upstream_receipt: freshReplacement,
            dependency_pin: freshDependency,
            refetched_from_receipt: staleUpstream,
            refetched_from_dependency_pin: staleDependency,
          },
        ],
      }),
    "consumed_receipts[0].refetched_from_receipt must be stale at as_of",
  );
});

test("transitive freshness evaluation reports stale hashes across multiple consumed receipts", () => {
  const freshUpstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-fresh",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const staleUpstream = makeReceipt({
    responsibilityId: "responsibility.C",
    contractRevision: C_CONTRACT,
    memoKey: "memo-C-stale",
    evidenceInputIds: [C_EVIDENCE],
    tokens: { fresh: 19, reused: 0 },
    freshnessNextForecastRecheck: "2026-05-18T13:00:00Z",
  });
  const freshDependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: freshUpstream,
    acceptable_signer_set: ["none"],
  });
  const staleDependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: staleUpstream,
    acceptable_signer_set: ["none"],
  });

  const evaluation = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-18T14:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    consumed_receipts: [
      {
        upstream_receipt: freshUpstream,
        dependency_pin: freshDependency,
      },
      {
        upstream_receipt: staleUpstream,
        dependency_pin: staleDependency,
      },
    ],
  });

  equal(evaluation.outcome, "stale-blocked");
  deepEqual(evaluation.stale_receipt_hashes, [staleUpstream.content_hash]);
  deepEqual(evaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: freshUpstream.content_hash,
      next_forecast_recheck: "2026-05-19T12:00:00Z",
      staleness_outcome: "fresh",
    },
    {
      receipt_hash: staleUpstream.content_hash,
      next_forecast_recheck: "2026-05-18T13:00:00Z",
      staleness_outcome: "stale-blocked",
    },
  ]);
});

test("transitive freshness evaluation fails closed on dependency pin mismatch", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });

  assertThrows(
    () =>
      evaluateTransitiveFreshnessV0({
        as_of: "2026-05-18T13:00:00Z",
        transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
        consumed_receipts: [
          {
            upstream_receipt: upstream,
            dependency_pin: {
              ...dependency,
              upstream_content_hash: A_EVIDENCE_V2,
            },
          },
        ],
      }),
    "upstream receipt content hash must match dependency pin",
  );
});

test("transitive freshness evaluation fails closed on invalid upstream receipt", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });
  const tampered = {
    ...upstream,
    freshness: {
      ...upstream.freshness,
      next_forecast_recheck: "2026-05-20T12:00:00Z",
    },
  };

  assertThrows(
    () =>
      evaluateTransitiveFreshnessV0({
        as_of: "2026-05-18T13:00:00Z",
        transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
        consumed_receipts: [
          {
            upstream_receipt: tampered,
            dependency_pin: dependency,
          },
        ],
      }),
    "upstream receipt must verify before dependency pin check",
  );
});

test("composed receipt freshness builder records receipt-compatible transitive metadata", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });

  const freshness = createComposedReceiptFreshnessV0({
    as_of: "2026-05-18T13:00:00Z",
    next_forecast_recheck: "2026-05-19T13:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    consumed_receipts: [
      {
        upstream_receipt: upstream,
        dependency_pin: dependency,
      },
    ],
  });

  deepEqual(freshness, {
    as_of: "2026-05-18T13:00:00Z",
    next_forecast_recheck: "2026-05-19T13:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    consumed_freshness_evaluated: [
      {
        receipt_hash: upstream.content_hash,
        next_forecast_recheck: "2026-05-19T12:00:00Z",
        staleness_outcome: "fresh",
      },
    ],
  });

  const downstream = makeReceipt({
    responsibilityId: "responsibility.B",
    contractRevision: B_CONTRACT,
    memoKey: "memo-B-transitive-freshness",
    evidenceInputIds: [B_EVIDENCE],
    consumedReceipts: [dependency],
    tokens: { fresh: 23, reused: 0 },
    asOf: "2026-05-18T13:00:00Z",
    freshness,
  });
  equal(
    downstream.freshness.transitive_freshness_policy_ref,
    "policy.transitive-freshness@v0",
  );
  deepEqual(downstream.freshness.consumed_freshness_evaluated, [
    {
      receipt_hash: upstream.content_hash,
      next_forecast_recheck: "2026-05-19T12:00:00Z",
      staleness_outcome: "fresh",
    },
  ]);

  assertThrows(
    () =>
      createComposedReceiptFreshnessV0({
        as_of: "2026-05-18T13:00:00Z",
        next_forecast_recheck: "2026-05-18T12:59:59Z",
        transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
        consumed_receipts: [
          {
            upstream_receipt: upstream,
            dependency_pin: dependency,
          },
        ],
      }),
    "next_forecast_recheck must not be before as_of",
  );
});

test("composition propagation rejudges on memo miss and stops on memo hit", () => {
  const memoStore = new InMemoryMemoStoreV0();
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });

  const miss = planCompositionPropagationV0({
    contract_revision: B_CONTRACT,
    evidence_receipts: [B_EVIDENCE],
    dependency_receipts: [dependency],
    memo_namespace: NAMESPACE,
    memo_store: memoStore,
    as_of: "2026-05-18T13:00:00Z",
    next_forecast_recheck: "2026-05-19T13:00:00Z",
  });

  equal(miss.outcome, "rejudge-required");
  equal(miss.memo_lookup.outcome, "miss");

  const downstreamReceipt = makeReceipt({
    responsibilityId: "responsibility.B",
    contractRevision: B_CONTRACT,
    memoKey: miss.memo_key,
    evidenceInputIds: [B_EVIDENCE],
    consumedReceipts: [dependency],
    tokens: { fresh: 61, reused: 0 },
  });
  memoStore.store(
    NAMESPACE,
    createMemoizedVerdictEntryV0(miss.memo_key, downstreamReceipt),
  );

  const hit = planCompositionPropagationV0({
    contract_revision: B_CONTRACT,
    evidence_receipts: [B_EVIDENCE],
    dependency_receipts: [dependency],
    memo_namespace: NAMESPACE,
    memo_store: memoStore,
    as_of: "2026-05-18T14:00:00Z",
    next_forecast_recheck: "2026-05-19T14:00:00Z",
  });

  equal(hit.outcome, "stop-memo-hit");
  if (hit.outcome !== "stop-memo-hit") {
    throw new Error("expected memo hit to stop propagation");
  }
  equal(hit.memo_lookup.outcome, "hit");
  equal(hit.memo_hit_receipt.core.memo_key, miss.memo_key);
  deepEqual(hit.memo_hit_receipt.composition.consumed_receipts, [dependency]);
  deepEqual(readTokenTruthV0(hit.memo_hit_receipt), {
    responsibility_id: "responsibility.B",
    run_id: "memo-hit-2026-05-18T14:00:00Z",
    provider: "memo",
    model: "memoized-verdict",
    role: "judge",
    tags: ["memo-hit", "composition-fixture"],
    as_of: "2026-05-18T14:00:00Z",
    fresh: 0,
    reused: 61,
    surprise_cause: "real-input",
  });
});

test("one upstream receipt amortizes across N downstream memo-hit propagations", () => {
  const memoStore = new InMemoryMemoStoreV0();
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 23, reused: 0 },
  });
  let upstreamPinDerivations = 0;
  const dependency = (() => {
    upstreamPinDerivations += 1;
    return dependencyReceiptPinFromVerifiedReceiptV0({
      upstream_receipt: upstream,
      acceptable_signer_set: ["none"],
    });
  })();
  const downstreamFixtures = [
    {
      responsibilityId: "responsibility.B",
      contractRevision: B_CONTRACT,
      evidence: B_EVIDENCE,
      fresh: 31,
      hitAsOf: "2026-05-18T14:00:00Z",
    },
    {
      responsibilityId: "responsibility.C",
      contractRevision: C_CONTRACT,
      evidence: C_EVIDENCE,
      fresh: 37,
      hitAsOf: "2026-05-18T15:00:00Z",
    },
    {
      responsibilityId: "responsibility.D",
      contractRevision: D_CONTRACT,
      evidence: D_EVIDENCE,
      fresh: 41,
      hitAsOf: "2026-05-18T16:00:00Z",
    },
  ] as const;
  const downstreamFreshReceipts: ReceiptV0[] = [];
  const downstreamMemoHitReceipts: ReceiptV0[] = [];

  for (const fixture of downstreamFixtures) {
    const miss = planCompositionPropagationV0({
      contract_revision: fixture.contractRevision,
      evidence_receipts: [fixture.evidence],
      dependency_receipts: [dependency],
      memo_namespace: NAMESPACE,
      memo_store: memoStore,
      as_of: "2026-05-18T13:00:00Z",
      next_forecast_recheck: "2026-05-19T13:00:00Z",
    });
    equal(miss.outcome, "rejudge-required");

    const downstreamReceipt = makeReceipt({
      responsibilityId: fixture.responsibilityId,
      contractRevision: fixture.contractRevision,
      memoKey: miss.memo_key,
      evidenceInputIds: [fixture.evidence],
      consumedReceipts: [dependency],
      tokens: { fresh: fixture.fresh, reused: 0 },
    });
    downstreamFreshReceipts.push(downstreamReceipt);
    memoStore.store(
      NAMESPACE,
      createMemoizedVerdictEntryV0(miss.memo_key, downstreamReceipt),
    );

    const hit = planCompositionPropagationV0({
      contract_revision: fixture.contractRevision,
      evidence_receipts: [fixture.evidence],
      dependency_receipts: [dependency],
      memo_namespace: NAMESPACE,
      memo_store: memoStore,
      as_of: fixture.hitAsOf,
      next_forecast_recheck: "2026-05-19T13:00:00Z",
    });
    equal(hit.outcome, "stop-memo-hit");
    if (hit.outcome !== "stop-memo-hit") {
      throw new Error("expected downstream memo hit");
    }

    downstreamMemoHitReceipts.push(hit.memo_hit_receipt);
    deepEqual(hit.dependency_receipts, [dependency]);
    deepEqual(hit.memo_hit_receipt.composition.consumed_receipts, [dependency]);
    equal(hit.memo_hit_receipt.cost.tokens.fresh, 0);
    equal(
      hit.memo_hit_receipt.cost.tokens.reused,
      downstreamReceipt.cost.tokens.fresh + downstreamReceipt.cost.tokens.reused,
    );
  }

  const receiptLog = [
    upstream,
    ...downstreamFreshReceipts,
    ...downstreamMemoHitReceipts,
  ];
  const upstreamFreshReceipts = receiptLog.filter(
    (receipt) =>
      receipt.core.responsibility_id === "responsibility.A" &&
      readTokenTruthV0(receipt).fresh > 0,
  );

  equal(upstreamPinDerivations, 1);
  deepEqual(
    downstreamMemoHitReceipts.map(
      (receipt) =>
        receipt.composition.consumed_receipts[0]?.upstream_content_hash,
    ),
    downstreamFixtures.map(() => upstream.content_hash),
  );
  deepEqual(
    downstreamMemoHitReceipts.map((receipt) => receipt.cost.tokens.fresh),
    downstreamFixtures.map(() => 0),
  );
  deepEqual(
    upstreamFreshReceipts.map((receipt) => receipt.content_hash),
    [upstream.content_hash],
  );
  equal(
    upstreamFreshReceipts.reduce(
      (total, receipt) => total + readTokenTruthV0(receipt).fresh,
      0,
    ),
    upstream.cost.tokens.fresh,
  );
});

test("composition helpers fail closed on invalid receipts, empty signers, and duplicate pins", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const tampered = {
    ...upstream,
    core: {
      ...upstream.core,
      memo_key: "memo-A-after-tamper",
    },
  };
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });
  const duplicateByUpstreamHash = {
    ...dependency,
    contract_revision: B_CONTRACT,
  };

  assertThrows(
    () =>
      dependencyReceiptPinFromVerifiedReceiptV0({
        upstream_receipt: tampered,
        acceptable_signer_set: ["none"],
      }),
    "upstream receipt must verify before composition",
  );
  assertThrows(
    () =>
      dependencyReceiptPinFromVerifiedReceiptV0({
        upstream_receipt: upstream,
        acceptable_signer_set: [],
      }),
    "acceptable_signer_set must not be empty",
  );
  assertThrows(
    () =>
      computeDownstreamComposedMemoKeyV0({
        contract_revision: B_CONTRACT,
        evidence_receipts: [B_EVIDENCE],
        dependency_receipts: [dependency, duplicateByUpstreamHash],
      }),
    `duplicate dependency receipt pin ${dependency.upstream_content_hash}`,
  );
});

test("composition memo hits must match the composed dependency pins", () => {
  const upstream = makeReceipt({
    responsibilityId: "responsibility.A",
    contractRevision: A_CONTRACT,
    memoKey: "memo-A-current",
    evidenceInputIds: [A_EVIDENCE_V1],
    tokens: { fresh: 17, reused: 0 },
  });
  const dependency = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });
  const memoKey = computeDownstreamComposedMemoKeyV0({
    contract_revision: B_CONTRACT,
    evidence_receipts: [B_EVIDENCE],
    dependency_receipts: [dependency],
  });
  const mismatchedReceipt = makeReceipt({
    responsibilityId: "responsibility.B",
    contractRevision: B_CONTRACT,
    memoKey,
    evidenceInputIds: [B_EVIDENCE],
    consumedReceipts: [],
    tokens: { fresh: 31, reused: 0 },
  });
  const malformedStore = {
    lookup(
      _namespace: PolicyArtifactMemoNamespaceV0,
      _memoKey: ContentHashV0,
    ): MemoLookupResultV0 {
      return {
        outcome: "hit",
        entry: {
          ...createMemoizedVerdictEntryV0(memoKey, mismatchedReceipt),
        } satisfies MemoizedVerdictV0,
      };
    },
  };

  assertThrows(
    () =>
      planCompositionPropagationV0({
        contract_revision: B_CONTRACT,
        evidence_receipts: [B_EVIDENCE],
        dependency_receipts: [dependency],
        memo_namespace: NAMESPACE,
        memo_store: malformedStore,
        as_of: "2026-05-18T14:00:00Z",
        next_forecast_recheck: "2026-05-19T14:00:00Z",
      }),
    "composition memo hit receipt dependencies must match composed input",
  );
});

function makeReceipt(input: {
  readonly responsibilityId: string;
  readonly contractRevision: ContentHashV0;
  readonly memoKey: string;
  readonly evidenceInputIds: readonly ContentHashV0[];
  readonly consumedReceipts?: readonly ConsumedReceiptPinV0[];
  readonly asOf?: string;
  readonly freshness?: ReceiptFreshnessV0;
  readonly freshnessNextForecastRecheck?: string;
  readonly tokens: {
    readonly fresh: number;
    readonly reused: number;
  };
  readonly eventCause?: ReceiptEventCauseV0;
}): ReceiptV0 {
  const asOf = input.asOf ?? "2026-05-18T12:00:00Z";
  const eventCause = input.eventCause ?? "real-input";
  const consumedReceipts = input.consumedReceipts ?? [];
  const freshness =
    input.freshness ??
    makeFixtureFreshness({
      asOf,
      nextForecastRecheck:
        input.freshnessNextForecastRecheck ?? "2026-05-19T12:00:00Z",
      consumedReceipts,
    });
  const receiptInput: ReceiptV0Input = {
    core: {
      responsibility_id: input.responsibilityId,
      contract_revision: input.contractRevision,
      event_cause: eventCause,
      memo_key: input.memoKey,
      evidence_input_ids: input.evidenceInputIds,
      as_of: asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "composition fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.92,
        derivation_method: "fixture",
        calibration_grade: "authored",
        label_source: "composition-fixture",
      },
    },
    freshness,
    composition: {
      consumed_receipts: consumedReceipts,
      cycle_checked: true,
    },
    cost: {
      provider: "cradle-double",
      model: "deterministic-replay",
      role: "judge",
      tags: ["composition-fixture"],
      responsibility_id: input.responsibilityId,
      run_id: `run-${input.responsibilityId}`,
      as_of: asOf,
      tokens: input.tokens,
      surprise_cause: eventCause,
    },
  };

  return createReceiptV0(receiptInput);
}

function makeFixtureFreshness(input: {
  readonly asOf: string;
  readonly nextForecastRecheck: string;
  readonly consumedReceipts: readonly ConsumedReceiptPinV0[];
}): ReceiptFreshnessV0 {
  return {
    as_of: input.asOf,
    next_forecast_recheck: input.nextForecastRecheck,
    ...(input.consumedReceipts.length === 0
      ? {}
      : {
          transitive_freshness_policy_ref:
            "policy.transitive-freshness.fixture@v0",
          consumed_freshness_evaluated: input.consumedReceipts.map(
            (pin) => ({
              receipt_hash: pin.upstream_content_hash,
              next_forecast_recheck: input.nextForecastRecheck,
              staleness_outcome: "fresh" as const,
            }),
          ),
        }),
  };
}

function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    ok(error instanceof Error);
    equal(error.message, message);
  }
  equal(threw, true);
}

function readPackageJson(): {
  readonly exports?: Record<string, unknown>;
} {
  const packageJsonPath = join(__dirname, "..", "..", "..", "package.json");

  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    readonly exports?: Record<string, unknown>;
  };
}
