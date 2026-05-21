import { equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import type {
  ContentHashV0,
  ReceiptV0,
  ReceiptV0Input,
} from "@openprose/reactor/receipt";
import type {
  ReactorAdaptersV0,
  ReactorConnectorResponseV0,
  ReactorCreateInputV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkV0,
} from "@openprose/reactor/sdk";

interface PublicB7ReactorRuntimeApiV0 {
  readonly createReactor: (input: ReactorCreateInputV0) => ReactorSdkV0;
}

interface PublicB7ReceiptApiV0 {
  readonly createReceiptV0: (input: ReceiptV0Input) => ReceiptV0;
  readonly verifyReceiptV0: (value: unknown) =>
    | {
        readonly ok: true;
        readonly content_hash: ContentHashV0;
      }
    | {
        readonly ok: false;
        readonly errors: readonly string[];
      };
}

const RESPONSIBILITY_ID = "responsibility.b7-transitive-freshness";
const UPSTREAM_RESPONSIBILITY_ID = "responsibility.b7.upstream";
const POLICY_NAMESPACE = "policy.b7.transitive-freshness";
const SOURCE_ID = "b7-observation";
const INGEST_AS_OF = "2026-05-19T06:00:00.000Z";
const UPSTREAM_FUTURE_RECHECK = "2026-05-19T12:00:00.000Z";
const DOWNSTREAM_NEXT_RECHECK = "2026-05-20T06:00:00.000Z";
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const UPSTREAM_CONTRACT_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const EVIDENCE_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const UPSTREAM_EVIDENCE_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as ContentHashV0;
const POLICY_ARTIFACT_HASH =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as ContentHashV0;
const PROJECTION_HASH =
  "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as ContentHashV0;
const b7RuntimeApi = loadB7RuntimeApi();
const b7ReceiptApi = loadB7ReceiptApi();

test("B7 authored transitive freshness function changes downstream freshness verdict", () => {
  const upstream = createUpstreamReceipt({
    next_forecast_recheck: UPSTREAM_FUTURE_RECHECK,
  });
  const kernelDefault = runB7FreshnessCase({
    policy_revision: "policy.b7.kernel-default",
    transitive_freshness_function: { kind: "kernel-default" },
    upstream,
  });
  const strictMinimumRemaining = runB7FreshnessCase({
    policy_revision: "policy.b7.strict-minimum-remaining",
    transitive_freshness_function: {
      kind: "minimum-remaining-freshness-ms",
      minimum_remaining_ms: 8 * 60 * 60 * 1000,
    },
    upstream,
  });

  equal(kernelDefault.result.accepted, true);
  equal(kernelDefault.result.outcome, "fresh-judge-receipt");
  equal(kernelDefault.modelRequests.length, 1);
  equal(kernelDefault.receipt.freshness.transitive_freshness_policy_ref, `${POLICY_NAMESPACE}@policy.b7.kernel-default`);
  equal(
    kernelDefault.receipt.freshness.consumed_freshness_evaluated?.[0]
      ?.staleness_outcome,
    "fresh",
  );

  equal(strictMinimumRemaining.result.accepted, true);
  equal(strictMinimumRemaining.result.outcome, "fresh-judge-receipt");
  equal(strictMinimumRemaining.modelRequests.length, 1);
  equal(strictMinimumRemaining.receipt.freshness.transitive_freshness_policy_ref, `${POLICY_NAMESPACE}@policy.b7.strict-minimum-remaining`);
  equal(
    strictMinimumRemaining.receipt.freshness.consumed_freshness_evaluated?.[0]
      ?.staleness_outcome,
    "stale-blocked",
  );

  const floorUpstream = createUpstreamReceipt({
    next_forecast_recheck: INGEST_AS_OF,
  });
  const kernelFloor = runB7FreshnessCase({
    policy_revision: "policy.b7.kernel-floor",
    transitive_freshness_function: { kind: "kernel-default" },
    upstream: floorUpstream,
  });

  equal(
    kernelFloor.receipt.freshness.consumed_freshness_evaluated?.[0]
      ?.staleness_outcome,
    "stale-blocked",
  );
});

function runB7FreshnessCase(input: {
  readonly policy_revision: string;
  readonly transitive_freshness_function: NonNullable<
    ReactorRegistrySnapshotV0["transitive_freshness_function"]
  >;
  readonly upstream: ReceiptV0;
}): {
  readonly result: ReturnType<ReactorSdkV0["ingest"]>;
  readonly receipt: ReceiptV0;
  readonly modelRequests: readonly ReactorModelGatewayRequestV0[];
} {
  const receipts: ReceiptV0[] = [];
  const modelRequests: ReactorModelGatewayRequestV0[] = [];
  const reactor = createPublicB7Reactor({
    responsibility_id: RESPONSIBILITY_ID,
    adapters: createB7Adapters({
      receipts,
      modelRequests,
      policy_revision: input.policy_revision,
      transitive_freshness_function: input.transitive_freshness_function,
    }),
  });

  const result = reactor.ingest({
    kind: "real-input",
    evidence: [
      {
        source_id: SOURCE_ID,
        content_hash: EVIDENCE_HASH,
      },
    ],
    dependency_receipts: [input.upstream],
  });
  const receipt = reactor.receipts().at(-1);
  ok(receipt !== undefined);
  const verification = b7ReceiptApi.verifyReceiptV0(receipt);
  ok(verification.ok);
  equal(result.receipt_hash, verification.content_hash);

  return {
    result,
    receipt,
    modelRequests,
  };
}

function createPublicB7Reactor(input: ReactorCreateInputV0): ReactorSdkV0 {
  return b7RuntimeApi.createReactor(input);
}

function loadB7RuntimeApi(): PublicB7ReactorRuntimeApiV0 {
  const sdkSurface = requireReactorSubpathSurface("sdk");

  if (typeof sdkSurface["createReactor"] !== "function") {
    throw new Error("B7 reactor SDK createReactor export is missing");
  }

  return {
    createReactor:
      sdkSurface["createReactor"] as PublicB7ReactorRuntimeApiV0["createReactor"],
  };
}

function loadB7ReceiptApi(): PublicB7ReceiptApiV0 {
  const receiptSurface = requireReactorSubpathSurface("receipt");

  if (typeof receiptSurface["createReceiptV0"] !== "function") {
    throw new Error("B7 reactor receipt createReceiptV0 export is missing");
  }
  if (typeof receiptSurface["verifyReceiptV0"] !== "function") {
    throw new Error("B7 reactor receipt verifyReceiptV0 export is missing");
  }

  return {
    createReceiptV0:
      receiptSurface["createReceiptV0"] as PublicB7ReceiptApiV0["createReceiptV0"],
    verifyReceiptV0:
      receiptSurface["verifyReceiptV0"] as PublicB7ReceiptApiV0["verifyReceiptV0"],
  };
}

function requireReactorSubpathSurface(
  subpath: "receipt" | "sdk",
): Record<string, unknown> {
  try {
    return require(`@openprose/reactor/${subpath}`) as Record<string, unknown>;
  } catch (packageError) {
    const packageMessage =
      packageError instanceof Error ? packageError.message : String(packageError);
    const workspaceDistCandidates = [
      join(process.cwd(), "..", "reactor", "dist", subpath),
      join(process.cwd(), "packages", "reactor", "dist", subpath),
    ];
    const distMessages: string[] = [];

    for (const workspaceDistSdk of workspaceDistCandidates) {
      try {
        return require(workspaceDistSdk) as Record<string, unknown>;
      } catch (distError) {
        distMessages.push(
          distError instanceof Error ? distError.message : String(distError),
        );
      }
    }

    throw new Error(
      `@openprose/reactor/${subpath} import failed (${packageMessage}); workspace dist fallback failed (${distMessages.join(" | ")})`,
    );
  }
}

function createUpstreamReceipt(input: {
  readonly next_forecast_recheck: string;
}): ReceiptV0 {
  return b7ReceiptApi.createReceiptV0({
    core: {
      responsibility_id: UPSTREAM_RESPONSIBILITY_ID,
      contract_revision: UPSTREAM_CONTRACT_HASH,
      event_cause: "real-input",
      memo_key: `b7-upstream:${input.next_forecast_recheck}`,
      evidence_input_ids: [UPSTREAM_EVIDENCE_HASH],
      as_of: "2026-05-19T00:00:00.000Z",
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "Cradle B7 deterministic upstream receipt",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.91,
        derivation_method: "cradle-b7-deterministic-fixture",
        calibration_grade: "none",
        label_source: "cradle-b7-transitive-freshness",
      },
    },
    freshness: {
      as_of: "2026-05-19T00:00:00.000Z",
      next_forecast_recheck: input.next_forecast_recheck,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "b7-deterministic-upstream-fixture",
      role: "judge",
      tags: ["b7-transitive-freshness", "upstream-fixture"],
      responsibility_id: UPSTREAM_RESPONSIBILITY_ID,
      run_id: `b7-upstream-${input.next_forecast_recheck}`,
      as_of: "2026-05-19T00:00:00.000Z",
      tokens: { fresh: 1, reused: 0 },
      surprise_cause: "real-input",
    },
  });
}

function createB7Adapters(input: {
  readonly receipts: ReceiptV0[];
  readonly modelRequests: ReactorModelGatewayRequestV0[];
  readonly policy_revision: string;
  readonly transitive_freshness_function: NonNullable<
    ReactorRegistrySnapshotV0["transitive_freshness_function"]
  >;
}): ReactorAdaptersV0 {
  let registry = createB7Registry({
    policy_revision: input.policy_revision,
    transitive_freshness_function: input.transitive_freshness_function,
  });

  return {
    clock: {
      now: () => INGEST_AS_OF,
    },
    storage: {
      appendReceipt(receipt): void {
        input.receipts.push(receipt);
      },
      listReceipts(): readonly ReceiptV0[] {
        return [...input.receipts];
      },
      readRegistry(): ReactorRegistrySnapshotV0 {
        return registry;
      },
      writeRegistry(nextRegistry): void {
        registry = nextRegistry;
      },
    },
    modelGateway: {
      invoke(request): ReactorModelGatewayResponseV0 {
        input.modelRequests.push(request);

        return {
          payload: {
            status: "up",
            confidence: {
              value: 0.74,
              derivation_method: "cradle-b7-shallow-judge",
              calibration_grade: "none",
              label_source: "cradle-b7-transitive-freshness",
            },
            cost_tags: {
              tags: ["b7-transitive-freshness"],
            },
          },
          usage: {
            provider: "cradle",
            model: "b7-shallow-judge",
            tokens: { fresh: 13, reused: 0 },
          },
        };
      },
    },
    agentSdk: {
      launch: (request) => ({ payload: request.payload }),
    },
    sandbox: {
      run: () => ({ exit_code: 0, stdout: "", stderr: "" }),
    },
    connectors: {
      read: (request): ReactorConnectorResponseV0 => ({ payload: request }),
    },
    eventSink: {
      emit: () => {},
    },
  };
}

function createB7Registry(input: {
  readonly policy_revision: string;
  readonly transitive_freshness_function: NonNullable<
    ReactorRegistrySnapshotV0["transitive_freshness_function"]
  >;
}): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    contract_summary: {
      summary: "B7 transitive freshness responsibility.",
      source_contract_revision: CONTRACT_HASH,
      projection_hash: PROJECTION_HASH,
    },
    policy_artifact_id: POLICY_NAMESPACE,
    policy_artifact_identity: POLICY_NAMESPACE,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: input.policy_revision,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    transitive_freshness_function: input.transitive_freshness_function,
    compiled_evidence_plan: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      policy_artifact_namespace: POLICY_NAMESPACE,
      policy_artifact_revision: input.policy_revision,
      plan_revision: `b7-transitive-freshness-plan:${input.policy_revision}`,
      as_of: "2026-05-19T05:30:00.000Z",
      evidence_order: "declared",
      sources: [
        {
          id: SOURCE_ID,
          kind: "adapter",
          required: true,
        },
      ],
    },
    forecast_schedule: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: `b7-transitive-freshness-registry:${input.policy_revision}`,
      evidence_input_ids: [EVIDENCE_HASH],
      next_evidence_recheck: DOWNSTREAM_NEXT_RECHECK,
      next_plan_recheck: "2026-05-21T06:00:00.000Z",
    },
  };
}
