import { deepEqual, equal, match, ok, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import type {
  ConsumedFreshnessEvaluationV0,
  ConsumedReceiptPinV0,
  ContentHashV0,
  ReceiptFreshnessV0,
  ReceiptTokensV0,
  ReceiptV0,
  ReceiptV0Input,
  ReceiptVerdictStatusV0,
} from "@openprose/reactor/receipt";
import type { CompiledEvidencePlan } from "@openprose/reactor/evidence-plan";
import type {
  ReactorAdaptersV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkEventV0,
} from "@openprose/reactor/sdk";

type ResponsibilityNodeIdV0 = "A" | "B" | "C";

interface TransitiveFreshnessConsumedReceiptInputV0 {
  readonly upstream_receipt: ReceiptV0;
  readonly dependency_pin: ConsumedReceiptPinV0;
  readonly refetched_from_receipt?: ReceiptV0;
  readonly refetched_from_dependency_pin?: ConsumedReceiptPinV0;
}

interface TransitiveFreshnessEvaluationInputV0 {
  readonly as_of: string;
  readonly transitive_freshness_policy_ref: string;
  readonly consumed_receipts: readonly TransitiveFreshnessConsumedReceiptInputV0[];
}

interface TransitiveFreshnessEvaluationResultV0 {
  readonly outcome: "fresh" | "stale-blocked";
  readonly as_of: string;
  readonly transitive_freshness_policy_ref: string;
  readonly stale_receipt_hashes: readonly ContentHashV0[];
  readonly consumed_freshness_evaluated: readonly ConsumedFreshnessEvaluationV0[];
}

interface ComposedReceiptFreshnessInputV0 extends TransitiveFreshnessEvaluationInputV0 {
  readonly next_forecast_recheck: string;
}

interface ReactorCompositionApiV0 {
  readonly computeDownstreamComposedMemoKeyV0: (input: {
    readonly contract_revision: ContentHashV0;
    readonly evidence_receipts: readonly ContentHashV0[];
    readonly dependency_receipts: readonly ConsumedReceiptPinV0[];
  }) => ContentHashV0;
  readonly dependencyReceiptPinFromVerifiedReceiptV0: (input: {
    readonly upstream_receipt: unknown;
    readonly acceptable_signer_set: readonly string[];
  }) => ConsumedReceiptPinV0;
  readonly verifyUpstreamReceiptDependencyPinV0: (input: {
    readonly upstream_receipt: unknown;
    readonly expected_dependency_pin: unknown;
  }) => {
    readonly receipt: ReceiptV0;
    readonly content_hash: ContentHashV0;
    readonly dependency_pin: ConsumedReceiptPinV0;
    readonly signer_posture: string;
  };
  readonly evaluateTransitiveFreshnessV0: (
    input: TransitiveFreshnessEvaluationInputV0,
  ) => unknown;
  readonly createComposedReceiptFreshnessV0: (
    input: ComposedReceiptFreshnessInputV0,
  ) => unknown;
}

interface ReactorReceiptApiV0 {
  readonly createReceiptV0: (input: ReceiptV0Input) => ReceiptV0;
  readonly verifyReceiptV0: (value: unknown) => {
    readonly ok: boolean;
    readonly content_hash?: ContentHashV0;
    readonly errors?: readonly string[];
  };
}

interface ReactorSdkHandleV0 {
  readonly adapters: ReactorAdaptersV0;
  readonly receipts: () => readonly ReceiptV0[];
  readonly registry: () => ReactorRegistrySnapshotV0;
  readonly export: () => unknown;
}

interface ReactorSdkApiV0 {
  readonly createReactor: (input: {
    readonly responsibility_id: string;
    readonly adapters: ReactorAdaptersV0;
  }) => ReactorSdkHandleV0;
  readonly importReactorExitBundleV0: (input: {
    readonly adapters: ReactorAdaptersV0;
    readonly bundle: unknown;
  }) => unknown;
  readonly verifyReactorExitBundleV0: (bundle: unknown) => unknown;
}

const CONTRACT_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const CONTRACT_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const CONTRACT_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const CONTRACT_ATTACKER =
  "sha256:9999999999999999999999999999999999999999999999999999999999999999" as ContentHashV0;
const EVIDENCE_A_STALE =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as ContentHashV0;
const EVIDENCE_A_FRESH =
  "sha256:2222222222222222222222222222222222222222222222222222222222222222" as ContentHashV0;
const EVIDENCE_B =
  "sha256:3333333333333333333333333333333333333333333333333333333333333333" as ContentHashV0;
const EVIDENCE_C =
  "sha256:4444444444444444444444444444444444444444444444444444444444444444" as ContentHashV0;
const POLICY_ARTIFACT_HASH =
  "sha256:5555555555555555555555555555555555555555555555555555555555555555" as ContentHashV0;
const TRANSITIVE_FRESHNESS_POLICY_REF =
  "policy://cradle.e2.transitive-freshness@policy-v0#transitive-freshness-v0";
const POLICY_ARTIFACT_BYTES =
  '{"schema":"openprose.policy-artifact","v":0,"name":"cradle.e2.transitive-freshness"}';
const MEMO_NAMESPACE = {
  policy_artifact_namespace: "cradle.e2.transitive-freshness",
  policy_artifact_revision: "policy-v0",
};
const A_STALE_AS_OF = "2026-05-18T10:00:00Z";
const A_FRESH_AS_OF = "2026-05-18T12:01:00Z";
const B_STALE_AS_OF = "2026-05-18T12:00:00Z";
const B_FRESH_AS_OF = "2026-05-18T12:10:00Z";
const C_AS_OF = "2026-05-18T13:00:00Z";
const B_NEXT_FORECAST_RECHECK = "2026-05-18T16:00:00Z";
const C_NEXT_FORECAST_RECHECK = "2026-05-18T17:00:00Z";
const EXPORT_AS_OF = "2026-05-18T17:30:00Z";
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const compositionApi =
  requirePublicReactorSubpath<ReactorCompositionApiV0>("composition");
const receiptApi = requirePublicReactorSubpath<ReactorReceiptApiV0>("receipt");
const sdkApi = requirePublicReactorSubpath<ReactorSdkApiV0>("sdk");

test("E2 enforces supply-chain pins, transitive freshness, and fork/exit carry-over", () => {
  const noLiveCalls = createNoLiveGatewayMonitor();
  const staleAReceipt = makeJudgeReceipt({
    id: "A",
    contractRevision: CONTRACT_A,
    memoKey: computeComposedMemoKey(CONTRACT_A, [EVIDENCE_A_STALE], []),
    evidenceInputIds: [EVIDENCE_A_STALE],
    consumedReceipts: [],
    asOf: A_STALE_AS_OF,
    nextForecastRecheck: B_STALE_AS_OF,
    tokens: { fresh: 29, reused: 0 },
  });
  const staleAPin = compositionApi.dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: staleAReceipt,
    acceptable_signer_set: ["none"],
  });
  const freshAReceipt = makeJudgeReceipt({
    id: "A",
    contractRevision: CONTRACT_A,
    memoKey: computeComposedMemoKey(CONTRACT_A, [EVIDENCE_A_FRESH], []),
    evidenceInputIds: [EVIDENCE_A_FRESH],
    consumedReceipts: [],
    asOf: A_FRESH_AS_OF,
    nextForecastRecheck: "2026-05-18T18:00:00Z",
    tokens: { fresh: 31, reused: 0 },
  });
  const freshAPin = compositionApi.dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: freshAReceipt,
    acceptable_signer_set: ["none"],
  });

  assertSupplyChainPinning(freshAReceipt, freshAPin);

  const staleEvaluation = evaluateTransitiveFreshness({
    as_of: B_STALE_AS_OF,
    transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
    consumed_receipts: [
      {
        upstream_receipt: staleAReceipt,
        dependency_pin: staleAPin,
      },
    ],
  });

  equal(staleEvaluation.outcome, "stale-blocked");
  deepEqual(staleEvaluation.stale_receipt_hashes, [staleAReceipt.content_hash]);
  deepEqual(staleEvaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: staleAReceipt.content_hash,
      next_forecast_recheck: B_STALE_AS_OF,
      staleness_outcome: "stale-blocked",
    },
  ]);

  const staleBFreshness = createComposedFreshness(
    {
      as_of: B_STALE_AS_OF,
      next_forecast_recheck: B_NEXT_FORECAST_RECHECK,
      transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
      consumed_receipts: [
        {
          upstream_receipt: staleAReceipt,
          dependency_pin: staleAPin,
        },
      ],
    },
    staleEvaluation.consumed_freshness_evaluated,
  );
  const staleBReceipt = makeJudgeReceipt({
    id: "B",
    contractRevision: CONTRACT_B,
    memoKey: computeComposedMemoKey(CONTRACT_B, [EVIDENCE_B], [staleAPin]),
    evidenceInputIds: [EVIDENCE_B],
    consumedReceipts: [staleAPin],
    asOf: B_STALE_AS_OF,
    freshness: staleBFreshness,
    status: "blocked",
    blockedReason: "stale upstream receipt blocked transitive freshness",
    tokens: { fresh: 0, reused: 0 },
  });

  assertReceiptVerifies(staleBReceipt);
  equal(staleBReceipt.verdict.status, "blocked");
  deepEqual(
    staleBReceipt.freshness.consumed_freshness_evaluated,
    staleEvaluation.consumed_freshness_evaluated,
  );

  const freshBEvaluation = evaluateTransitiveFreshness({
    as_of: B_FRESH_AS_OF,
    transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
    consumed_receipts: [
      {
        upstream_receipt: freshAReceipt,
        dependency_pin: freshAPin,
        refetched_from_receipt: staleAReceipt,
        refetched_from_dependency_pin: staleAPin,
      },
    ],
  });

  equal(freshBEvaluation.outcome, "fresh");
  deepEqual(freshBEvaluation.stale_receipt_hashes, []);
  deepEqual(freshBEvaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: freshAReceipt.content_hash,
      next_forecast_recheck: "2026-05-18T18:00:00Z",
      staleness_outcome: "stale-refetched",
    },
  ]);

  const freshBReceipt = makeJudgeReceipt({
    id: "B",
    contractRevision: CONTRACT_B,
    memoKey: computeComposedMemoKey(CONTRACT_B, [EVIDENCE_B], [freshAPin]),
    evidenceInputIds: [EVIDENCE_B],
    consumedReceipts: [freshAPin],
    asOf: B_FRESH_AS_OF,
    freshness: createComposedFreshness(
      {
        as_of: B_FRESH_AS_OF,
        next_forecast_recheck: B_NEXT_FORECAST_RECHECK,
        transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
        consumed_receipts: [
          {
            upstream_receipt: freshAReceipt,
            dependency_pin: freshAPin,
            refetched_from_receipt: staleAReceipt,
            refetched_from_dependency_pin: staleAPin,
          },
        ],
      },
      freshBEvaluation.consumed_freshness_evaluated,
    ),
    tokens: { fresh: 41, reused: 0 },
  });
  const freshBPin = compositionApi.dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: freshBReceipt,
    acceptable_signer_set: ["none"],
  });
  const freshCEvaluation = evaluateTransitiveFreshness({
    as_of: C_AS_OF,
    transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
    consumed_receipts: [
      {
        upstream_receipt: freshBReceipt,
        dependency_pin: freshBPin,
      },
    ],
  });

  equal(freshCEvaluation.outcome, "fresh");
  deepEqual(freshCEvaluation.consumed_freshness_evaluated, [
    {
      receipt_hash: freshBReceipt.content_hash,
      next_forecast_recheck: B_NEXT_FORECAST_RECHECK,
      staleness_outcome: "fresh",
    },
  ]);

  const freshCReceipt = makeJudgeReceipt({
    id: "C",
    contractRevision: CONTRACT_C,
    memoKey: computeComposedMemoKey(CONTRACT_C, [EVIDENCE_C], [freshBPin]),
    evidenceInputIds: [EVIDENCE_C],
    consumedReceipts: [freshBPin],
    asOf: C_AS_OF,
    freshness: createComposedFreshness(
      {
        as_of: C_AS_OF,
        next_forecast_recheck: C_NEXT_FORECAST_RECHECK,
        transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
        consumed_receipts: [
          {
            upstream_receipt: freshBReceipt,
            dependency_pin: freshBPin,
          },
        ],
      },
      freshCEvaluation.consumed_freshness_evaluated,
    ),
    tokens: { fresh: 43, reused: 0 },
  });

  deepEqual(freshBReceipt.composition.consumed_receipts, [freshAPin]);
  deepEqual(freshCReceipt.composition.consumed_receipts, [freshBPin]);
  equal(
    freshCReceipt.core.memo_key,
    computeComposedMemoKey(CONTRACT_C, [EVIDENCE_C], [freshBPin]),
  );
  assertReceiptVerifies(freshBReceipt);
  assertReceiptVerifies(freshCReceipt);

  assertExitBundlesCarryGraph({
    monitor: noLiveCalls,
    receipts: {
      A: [staleAReceipt, freshAReceipt],
      B: [staleBReceipt, freshBReceipt],
      C: [freshCReceipt],
    },
    expectedPins: {
      A: [],
      B: [staleAPin, freshAPin],
      C: [freshBPin],
    },
  });
  deepEqual(noLiveCalls.counts(), {
    modelGateway: 0,
    agentSdk: 0,
    sandbox: 0,
    connector: 0,
    signer: 0,
  });
});

function assertSupplyChainPinning(
  upstreamReceipt: ReceiptV0,
  expectedPin: ConsumedReceiptPinV0,
): void {
  const verified = compositionApi.verifyUpstreamReceiptDependencyPinV0({
    upstream_receipt: upstreamReceipt,
    expected_dependency_pin: expectedPin,
  });

  equal(verified.content_hash, upstreamReceipt.content_hash);
  equal(verified.signer_posture, "none");
  deepEqual(verified.dependency_pin, expectedPin);

  throws(
    () =>
      compositionApi.verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstreamReceipt,
        expected_dependency_pin: {
          ...expectedPin,
          contract_revision: CONTRACT_ATTACKER,
        },
      }),
    /contract revision|dependency pin/i,
  );
  throws(
    () =>
      compositionApi.verifyUpstreamReceiptDependencyPinV0({
        upstream_receipt: upstreamReceipt,
        expected_dependency_pin: {
          ...expectedPin,
          acceptable_signer_set: ["detached-test-signer"],
        },
      }),
    /signer posture|allowed/i,
  );
}

function evaluateTransitiveFreshness(
  input: TransitiveFreshnessEvaluationInputV0,
): TransitiveFreshnessEvaluationResultV0 {
  return asTransitiveFreshnessEvaluationResult(
    compositionApi.evaluateTransitiveFreshnessV0(input),
  );
}

function createComposedFreshness(
  input: ComposedReceiptFreshnessInputV0,
  expectedConsumedFreshnessEvaluated: readonly ConsumedFreshnessEvaluationV0[],
): ReceiptFreshnessV0 {
  const freshness = asReceiptFreshness(
    compositionApi.createComposedReceiptFreshnessV0(input),
  );

  deepEqual(freshness, {
    as_of: input.as_of,
    next_forecast_recheck: input.next_forecast_recheck,
    transitive_freshness_policy_ref: input.transitive_freshness_policy_ref,
    consumed_freshness_evaluated: expectedConsumedFreshnessEvaluated,
  });

  return freshness;
}

function assertExitBundlesCarryGraph(input: {
  readonly monitor: NoLiveGatewayMonitorV0;
  readonly receipts: Readonly<Record<ResponsibilityNodeIdV0, readonly ReceiptV0[]>>;
  readonly expectedPins: Readonly<
    Record<ResponsibilityNodeIdV0, readonly ConsumedReceiptPinV0[]>
  >;
}): void {
  for (const id of ["A", "B", "C"] as const) {
    const sourceReceipts = [...input.receipts[id]];
    const sourceRegistry = makeRegistry(id);
    const source = sdkApi.createReactor({
      responsibility_id: `responsibility.${id}`,
      adapters: input.monitor.makeAdapters({
        receipts: sourceReceipts,
        registry: sourceRegistry,
        now: EXPORT_AS_OF,
      }),
    });
    const bundle = asExitBundle(source.export());

    assertExitBundleCarriesNode({
      id,
      bundle,
      receipts: sourceReceipts,
      expectedPins: input.expectedPins[id],
      expectedRegistry: sourceRegistry,
    });
    expectOkResult(
      sdkApi.verifyReactorExitBundleV0(bundle),
      `verified ${id} exit bundle`,
    );

    const importedReceipts: ReceiptV0[] = [];
    const fresh = sdkApi.createReactor({
      responsibility_id: `responsibility.${id}`,
      adapters: input.monitor.makeAdapters({
        receipts: importedReceipts,
        registry: makeUninitializedRegistry(),
        now: EXPORT_AS_OF,
      }),
    });

    const importResult = expectOkResult(
      sdkApi.importReactorExitBundleV0({
        adapters: fresh.adapters,
        bundle,
      }),
      `${id} exit bundle import`,
    );

    equal(importResult["receipts_appended"], sourceReceipts.length);
    deepEqual(importResult["memo_namespace"], MEMO_NAMESPACE);
    deepEqual(fresh.receipts(), sourceReceipts);
    assertRuntimeRegistryHydratedExactly(fresh.registry(), sourceRegistry);
  }
}

function assertExitBundleCarriesNode(input: {
  readonly id: ResponsibilityNodeIdV0;
  readonly bundle: ExitBundleRecordV0;
  readonly receipts: readonly ReceiptV0[];
  readonly expectedPins: readonly ConsumedReceiptPinV0[];
  readonly expectedRegistry: ReactorRegistrySnapshotV0;
}): void {
  const contractRevision = contractRevisionForNode(input.id);
  const expectedPins = sortDependencyPins(input.expectedPins);
  const receiptLog = asRecord(input.bundle["receipt_log"], "bundle.receipt_log");
  const policyArtifact = asRecord(
    input.bundle["policy_artifact"],
    "bundle.policy_artifact",
  );
  const manifest = asRecord(input.bundle["manifest"], "bundle.manifest");
  const runtimeRegistry = asRecord(
    input.bundle["runtime_registry"],
    "bundle.runtime_registry",
  );

  equal(input.bundle["contract_revision"], contractRevision);
  equal(policyArtifact["identity"], `policy.cradle.e2.${input.id}`);
  equal(policyArtifact["bytes"], POLICY_ARTIFACT_BYTES);
  equal(policyArtifact["content_hash"], POLICY_ARTIFACT_HASH);
  deepEqual(input.bundle["memo_namespace"], MEMO_NAMESPACE);
  deepEqual(input.bundle["dependency_receipt_pins"], expectedPins);
  deepEqual(manifest["dependency_receipt_pins"], expectedPins);
  equal(manifest["runtime_registry_content_hash"], runtimeRegistry["content_hash"]);
  equal(input.bundle["as_of"], EXPORT_AS_OF);
  assertRuntimeRegistryProjection(runtimeRegistry, input.expectedRegistry);

  const memberHashes = input.receipts.map((receipt) => receipt.content_hash).sort();
  deepEqual(
    asContentHashArray(receiptLog["member_hashes"], "member hashes"),
    memberHashes,
  );
  equal(receiptLog["head"], newestReceipt(input.receipts).content_hash);
  deepEqual(
    asReceiptArray(receiptLog["entries"], "receipt entries"),
    input.receipts,
  );
}

function assertRuntimeRegistryProjection(
  projection: Readonly<Record<string, unknown>>,
  expected: ReactorRegistrySnapshotV0,
): void {
  equal(projection["schema"], "openprose.reactor.exit-bundle.runtime-registry");
  equal(projection["v"], 0);
  match(
    asContentHash(projection["content_hash"], "runtime registry content hash"),
    CONTENT_HASH_PATTERN,
  );
  equal(projection["contract_revision"], expected.contract_revision);
  equal(
    projection["policy_artifact_namespace"],
    expected.policy_artifact_namespace,
  );
  equal(
    projection["policy_artifact_revision"],
    expected.policy_artifact_revision,
  );
  deepEqual(
    projection["compiled_evidence_plan"],
    expected.compiled_evidence_plan,
  );
  deepEqual(projection["forecast_schedule"], expected.forecast_schedule);
}

function assertRuntimeRegistryHydratedExactly(
  actual: ReactorRegistrySnapshotV0,
  expected: ReactorRegistrySnapshotV0,
): void {
  equal(actual.contract_revision, expected.contract_revision);
  equal(actual.policy_artifact_id, expected.policy_artifact_id);
  equal(actual.policy_artifact_identity, expected.policy_artifact_identity);
  equal(actual.policy_artifact_namespace, expected.policy_artifact_namespace);
  equal(actual.policy_artifact_revision, expected.policy_artifact_revision);
  deepEqual(
    actual.policy_artifact_validation_state,
    expected.policy_artifact_validation_state,
  );
  deepEqual(actual.validation_state, expected.validation_state);
  equal(actual.policy_artifact_bytes, expected.policy_artifact_bytes);
  equal(actual.policy_artifact_content_hash, expected.policy_artifact_content_hash);
  deepEqual(actual.compiled_evidence_plan, expected.compiled_evidence_plan);
  deepEqual(actual.forecast_schedule, expected.forecast_schedule);
}

function makeJudgeReceipt(input: {
  readonly id: ResponsibilityNodeIdV0;
  readonly contractRevision: ContentHashV0;
  readonly memoKey: ContentHashV0;
  readonly evidenceInputIds: readonly ContentHashV0[];
  readonly consumedReceipts: readonly ConsumedReceiptPinV0[];
  readonly asOf: string;
  readonly nextForecastRecheck?: string;
  readonly freshness?: ReceiptFreshnessV0;
  readonly status?: ReceiptVerdictStatusV0;
  readonly blockedReason?: string;
  readonly tokens: ReceiptTokensV0;
}): ReceiptV0 {
  const status = input.status ?? "up";
  const freshness =
    input.freshness ??
    makeRootFreshness(
      input.asOf,
      input.nextForecastRecheck ?? "2026-05-19T12:00:00Z",
    );
  const receiptInput: ReceiptV0Input = {
    core: {
      responsibility_id: `responsibility.${input.id}`,
      contract_revision: input.contractRevision,
      event_cause: "real-input",
      memo_key: input.memoKey,
      evidence_input_ids: input.evidenceInputIds,
      as_of: input.asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "E2 composition integration uses local deterministic receipts",
    },
    verdict:
      status === "blocked"
        ? {
            status,
            confidence: {
              value: 0.9,
              derivation_method: "deterministic transitive freshness backstop",
              calibration_grade: "authored",
              label_source: "cradle e2 fixture",
            },
            blocked: {
              reason: input.blockedReason ?? "blocked by transitive freshness",
              fix_target: "refresh upstream receipt evidence",
              interrupt_cause: "needs-input",
            },
          }
        : {
            status,
            confidence: {
              value: 0.94,
              derivation_method: "local deterministic judge",
              calibration_grade: "authored",
              label_source: "cradle e2 fixture",
            },
          },
    freshness,
    composition: {
      consumed_receipts: input.consumedReceipts,
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "deterministic-local-judge",
      role: "judge",
      tags: ["e2-composition", "local-judge"],
      responsibility_id: `responsibility.${input.id}`,
      run_id: `e2-composition-${input.id}-${input.asOf}`,
      as_of: input.asOf,
      tokens: input.tokens,
      surprise_cause: "real-input",
    },
  };

  return receiptApi.createReceiptV0(receiptInput);
}

function computeComposedMemoKey(
  contractRevision: ContentHashV0,
  evidenceReceipts: readonly ContentHashV0[],
  dependencyReceipts: readonly ConsumedReceiptPinV0[],
): ContentHashV0 {
  return compositionApi.computeDownstreamComposedMemoKeyV0({
    contract_revision: contractRevision,
    evidence_receipts: evidenceReceipts,
    dependency_receipts: dependencyReceipts,
  });
}

function makeRootFreshness(
  asOf: string,
  nextForecastRecheck: string,
): ReceiptFreshnessV0 {
  return {
    as_of: asOf,
    next_forecast_recheck: nextForecastRecheck,
  };
}

function makeRegistry(id: ResponsibilityNodeIdV0): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: contractRevisionForNode(id),
    policy_artifact_id: `policy.cradle.e2.${id}.registry-row`,
    policy_artifact_identity: `policy.cradle.e2.${id}`,
    policy_artifact_namespace: MEMO_NAMESPACE.policy_artifact_namespace,
    policy_artifact_revision: MEMO_NAMESPACE.policy_artifact_revision,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_bytes: POLICY_ARTIFACT_BYTES,
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    compiled_evidence_plan: makeCompiledEvidencePlan(id),
    forecast_schedule: makeForecastSchedule(id),
  };
}

function makeUninitializedRegistry(): ReactorRegistrySnapshotV0 {
  return {
    policy_artifact_namespace: "policy.uninitialized",
    policy_artifact_revision: "0",
  };
}

function makeCompiledEvidencePlan(
  id: ResponsibilityNodeIdV0,
): CompiledEvidencePlan {
  return {
    responsibility_id: `responsibility.${id}`,
    contract_revision: contractRevisionForNode(id),
    policy_artifact_namespace: MEMO_NAMESPACE.policy_artifact_namespace,
    policy_artifact_revision: MEMO_NAMESPACE.policy_artifact_revision,
    plan_revision: `e2-${id}-compiled-plan-1`,
    as_of: planAsOfForNode(id),
    evidence_order: "declared",
    sources: evidencePlanSourcesForNode(id),
  };
}

function evidencePlanSourcesForNode(
  id: ResponsibilityNodeIdV0,
): CompiledEvidencePlan["sources"] {
  const localSource = {
    id: `evidence.${id}`,
    kind: "adapter" as const,
    required: true,
  };

  if (id === "A") {
    return [localSource];
  }

  return [
    localSource,
    {
      id: id === "B" ? "dependency.A" : "dependency.B",
      kind: "dependency",
      required: true,
      receipt_order: "declared",
    },
  ];
}

function makeForecastSchedule(
  id: ResponsibilityNodeIdV0,
): NonNullable<ReactorRegistrySnapshotV0["forecast_schedule"]> {
  return {
    responsibility_id: `responsibility.${id}`,
    contract_revision: contractRevisionForNode(id),
    memo_key: forecastMemoKeyForNode(id),
    evidence_input_ids: evidenceInputIdsForNode(id),
    next_evidence_recheck: nextEvidenceRecheckForNode(id),
    next_plan_recheck: nextPlanRecheckForNode(id),
  };
}

function planAsOfForNode(id: ResponsibilityNodeIdV0): string {
  if (id === "A") {
    return A_FRESH_AS_OF;
  }
  if (id === "B") {
    return B_FRESH_AS_OF;
  }

  return C_AS_OF;
}

function forecastMemoKeyForNode(id: ResponsibilityNodeIdV0): ContentHashV0 {
  if (id === "A") {
    return computeComposedMemoKey(CONTRACT_A, [EVIDENCE_A_FRESH], []);
  }
  if (id === "B") {
    return computeComposedMemoKey(CONTRACT_B, [EVIDENCE_B], []);
  }

  return computeComposedMemoKey(CONTRACT_C, [EVIDENCE_C], []);
}

function evidenceInputIdsForNode(
  id: ResponsibilityNodeIdV0,
): readonly ContentHashV0[] {
  if (id === "A") {
    return [EVIDENCE_A_FRESH];
  }
  if (id === "B") {
    return [EVIDENCE_B];
  }

  return [EVIDENCE_C];
}

function nextEvidenceRecheckForNode(id: ResponsibilityNodeIdV0): string {
  if (id === "A") {
    return "2026-05-18T18:00:00Z";
  }
  if (id === "B") {
    return B_NEXT_FORECAST_RECHECK;
  }

  return C_NEXT_FORECAST_RECHECK;
}

function nextPlanRecheckForNode(id: ResponsibilityNodeIdV0): string {
  if (id === "A") {
    return "2026-05-19T10:00:00Z";
  }
  if (id === "B") {
    return "2026-05-19T12:10:00Z";
  }

  return "2026-05-19T13:00:00Z";
}

function contractRevisionForNode(id: ResponsibilityNodeIdV0): ContentHashV0 {
  if (id === "A") {
    return CONTRACT_A;
  }
  if (id === "B") {
    return CONTRACT_B;
  }

  return CONTRACT_C;
}

function assertReceiptVerifies(receipt: ReceiptV0): void {
  const verification = receiptApi.verifyReceiptV0(receipt);

  equal(verification.ok, true);
  equal(verification.content_hash, receipt.content_hash);
}

function sortDependencyPins(
  pins: readonly ConsumedReceiptPinV0[],
): readonly ConsumedReceiptPinV0[] {
  return [...pins].sort((left, right) => {
    const upstream = left.upstream_content_hash.localeCompare(
      right.upstream_content_hash,
    );
    if (upstream !== 0) {
      return upstream;
    }

    const contract = left.contract_revision.localeCompare(right.contract_revision);
    if (contract !== 0) {
      return contract;
    }

    return left.acceptable_signer_set
      .join("\0")
      .localeCompare(right.acceptable_signer_set.join("\0"));
  });
}

function newestReceipt(receipts: readonly ReceiptV0[]): ReceiptV0 {
  const newest = [...receipts].sort((left, right) => {
    const byAsOf = left.core.as_of.localeCompare(right.core.as_of);

    return byAsOf === 0
      ? left.content_hash.localeCompare(right.content_hash)
      : byAsOf;
  })[receipts.length - 1];

  ok(newest, "receipt log must not be empty");

  return newest;
}

interface NoLiveGatewayMonitorV0 {
  readonly counts: () => Readonly<Record<string, number>>;
  readonly makeAdapters: (input: {
    readonly receipts: ReceiptV0[];
    readonly registry: ReactorRegistrySnapshotV0;
    readonly now: string;
  }) => ReactorAdaptersV0;
}

function createNoLiveGatewayMonitor(): NoLiveGatewayMonitorV0 {
  const calls = {
    modelGateway: 0,
    agentSdk: 0,
    sandbox: 0,
    connector: 0,
    signer: 0,
  };

  return {
    counts: () => ({ ...calls }),
    makeAdapters(input): ReactorAdaptersV0 {
      const emitted: ReactorSdkEventV0[] = [];
      let registry = input.registry;

      return {
        clock: {
          now: () => input.now,
        },
        storage: {
          appendReceipt: (receipt) => {
            input.receipts.push(receipt);
          },
          listReceipts: () => input.receipts,
          readRegistry: () => registry,
          writeRegistry: (nextRegistry) => {
            registry = nextRegistry;
          },
        },
        modelGateway: {
          invoke: () => {
            calls.modelGateway += 1;
            throw new Error("live model/API gateway must not be used in E2");
          },
        },
        agentSdk: {
          launch: () => {
            calls.agentSdk += 1;
            throw new Error("agent gateway must not be used in E2");
          },
        },
        sandbox: {
          run: () => {
            calls.sandbox += 1;
            throw new Error("sandbox gateway must not be used in E2");
          },
        },
        signer: {
          scheme: "none",
          null_reason: "no-signer-adapter-configured",
        },
        connectors: {
          read: () => {
            calls.connector += 1;
            throw new Error("connector gateway must not be used in E2");
          },
        },
        eventSink: {
          emit: (event) => {
            emitted.push(event);
          },
        },
      };
    },
  };
}

function asTransitiveFreshnessEvaluationResult(
  value: unknown,
): TransitiveFreshnessEvaluationResultV0 {
  const record = asRecord(value, "transitive freshness evaluation");
  const outcome = record["outcome"];

  if (outcome !== "fresh" && outcome !== "stale-blocked") {
    throw new Error("transitive freshness evaluation outcome must be fresh or stale-blocked");
  }

  return {
    outcome,
    as_of: asIsoInstant(
      record["as_of"],
      "transitive freshness evaluation as_of",
    ),
    transitive_freshness_policy_ref: asNonEmptyString(
      record["transitive_freshness_policy_ref"],
      "transitive freshness policy ref",
    ),
    stale_receipt_hashes: asContentHashArray(
      record["stale_receipt_hashes"],
      "transitive freshness stale receipt hashes",
    ),
    consumed_freshness_evaluated: asConsumedFreshnessEvaluations(
      record["consumed_freshness_evaluated"],
      "transitive freshness consumed evaluations",
    ),
  };
}

function asReceiptFreshness(value: unknown): ReceiptFreshnessV0 {
  const record = asRecord(value, "receipt freshness");
  const policyRef = record["transitive_freshness_policy_ref"];
  const consumed = record["consumed_freshness_evaluated"];

  if (typeof policyRef !== "string" || policyRef.length === 0) {
    throw new Error("receipt freshness policy ref must be non-empty");
  }

  return {
    as_of: asIsoInstant(record["as_of"], "receipt freshness as_of"),
    next_forecast_recheck: asIsoInstant(
      record["next_forecast_recheck"],
      "receipt freshness next recheck",
    ),
    transitive_freshness_policy_ref: policyRef,
    consumed_freshness_evaluated: asConsumedFreshnessEvaluations(
      consumed,
      "receipt freshness consumed evaluations",
    ),
  };
}

function asConsumedFreshnessEvaluations(
  value: unknown,
  label: string,
): readonly ConsumedFreshnessEvaluationV0[] {
  return asArray(value, label).map((item, index) => {
    const record = asRecord(item, `${label}[${index}]`);
    const outcome = record["staleness_outcome"];

    if (
      outcome !== "fresh" &&
      outcome !== "stale-refetched" &&
      outcome !== "stale-blocked"
    ) {
      throw new Error(`${label}[${index}].staleness_outcome is invalid`);
    }

    return {
      receipt_hash: asContentHash(record["receipt_hash"], `${label}[${index}].receipt_hash`),
      next_forecast_recheck: asIsoInstant(
        record["next_forecast_recheck"],
        `${label}[${index}].next_forecast_recheck`,
      ),
      staleness_outcome: outcome,
    };
  });
}

interface ExitBundleRecordV0 extends Readonly<Record<string, unknown>> {
  readonly contract_revision: unknown;
  readonly policy_artifact: unknown;
  readonly runtime_registry: unknown;
  readonly receipt_log: unknown;
  readonly dependency_receipt_pins: unknown;
  readonly manifest: unknown;
  readonly memo_namespace: unknown;
  readonly as_of: unknown;
}

function asExitBundle(value: unknown): ExitBundleRecordV0 {
  const bundle = asRecord(value, "exit bundle");

  for (const key of [
    "contract_revision",
    "policy_artifact",
    "runtime_registry",
    "receipt_log",
    "dependency_receipt_pins",
    "manifest",
    "memo_namespace",
    "as_of",
  ] as const) {
    ok(key in bundle, `exit bundle must include ${key}`);
  }

  return bundle as ExitBundleRecordV0;
}

function expectOkResult(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  const result = asRecord(value, label);

  equal(result["ok"], true);

  return result;
}

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function asReceiptArray(value: unknown, label: string): readonly ReceiptV0[] {
  return asArray(value, label).map((item, index) => {
    const verification = receiptApi.verifyReceiptV0(item);

    if (!verification.ok) {
      throw new Error(`${label}[${index}] must verify as receipt v0`);
    }

    return item as ReceiptV0;
  });
}

function asContentHashArray(value: unknown, label: string): readonly ContentHashV0[] {
  return asArray(value, label).map((item, index) =>
    asContentHash(item, `${label}[${index}]`),
  );
}

function asContentHash(value: unknown, label: string): ContentHashV0 {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a content hash string`);
  }
  match(value, CONTENT_HASH_PATTERN);

  return value as ContentHashV0;
}

function asIsoInstant(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be an ISO instant string`);
  }
  match(value, ISO_INSTANT_PATTERN);

  return value;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function requirePublicReactorSubpath<T>(
  subpath: "composition" | "receipt" | "sdk",
): T {
  const packageSubpath = `@openprose/reactor/${subpath}`;
  try {
    return require(packageSubpath) as T;
  } catch (packageError) {
    if (!isMissingReactorSubpath(packageError, packageSubpath)) {
      throw packageError;
    }

    const packageMessage =
      packageError instanceof Error ? packageError.message : String(packageError);
    const exportTarget = readReactorPackageExportTarget(subpath);

    try {
      return require(join(reactorPackageRoot(), exportTarget)) as T;
    } catch (exportTargetError) {
      const exportTargetMessage =
        exportTargetError instanceof Error
          ? exportTargetError.message
          : String(exportTargetError);
      throw new Error(
        `${packageSubpath} public import failed (${packageMessage}); declared export target ${exportTarget} failed (${exportTargetMessage})`,
      );
    }
  }
}

function readReactorPackageExportTarget(
  subpath: "composition" | "receipt" | "sdk",
): string {
  const packageJson = JSON.parse(
    readFileSync(join(reactorPackageRoot(), "package.json"), "utf8"),
  ) as {
    readonly exports?: Record<
      string,
      {
        readonly default?: unknown;
      }
    >;
  };
  const exportEntry = packageJson.exports?.[`./${subpath}`];

  if (typeof exportEntry?.default !== "string") {
    throw new Error(`@openprose/reactor/${subpath} is missing from package exports`);
  }

  return exportEntry.default;
}

function reactorPackageRoot(): string {
  return join(process.cwd(), "..", "reactor");
}

function isMissingReactorSubpath(error: unknown, packageSubpath: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error["code"] === "MODULE_NOT_FOUND" &&
    error.message.includes(packageSubpath)
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
