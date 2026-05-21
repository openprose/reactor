import { equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import type {
  ConsumedReceiptPinV0,
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

interface PublicB4ReactorRuntimeApiV0 {
  readonly createReactor: (input: ReactorCreateInputV0) => ReactorSdkV0;
}

interface PublicB4ReceiptApiV0 {
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

const RESPONSIBILITY_ID = "responsibility.b4-cycle-detection";
const GRAPH_A_ID = "responsibility.b4.graph.A";
const GRAPH_B_ID = "responsibility.b4.graph.B";
const POLICY_NAMESPACE = "policy.b4.cycle-detection";
const POLICY_REVISION = "policy.b4.seed";
const SOURCE_ID = "b4-cycle-observation";
const INGEST_AS_OF = "2026-05-19T16:00:00.000Z";
const NEXT_FORECAST_RECHECK = "2026-05-20T16:00:00.000Z";
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const CONTRACT_A =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const CONTRACT_B =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const EVIDENCE_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as ContentHashV0;
const EVIDENCE_A_PRIOR =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as ContentHashV0;
const EVIDENCE_B =
  "sha256:2222222222222222222222222222222222222222222222222222222222222222" as ContentHashV0;
const EVIDENCE_A_CYCLIC =
  "sha256:3333333333333333333333333333333333333333333333333333333333333333" as ContentHashV0;
const POLICY_ARTIFACT_HASH =
  "sha256:4444444444444444444444444444444444444444444444444444444444444444" as ContentHashV0;
const PROJECTION_HASH =
  "sha256:5555555555555555555555555555555555555555555555555555555555555555" as ContentHashV0;
const b4RuntimeApi = loadB4RuntimeApi();
const b4ReceiptApi = loadB4ReceiptApi();

test("B4 ingest blocks an A->B->A dependency receipt graph before invoking the model gateway", () => {
  const modelRequests: ReactorModelGatewayRequestV0[] = [];
  const runtimeReceipts: ReceiptV0[] = [];
  const reactor = createPublicB4Reactor({
    responsibility_id: RESPONSIBILITY_ID,
    adapters: createB4Adapters({ receipts: runtimeReceipts, modelRequests }),
  });
  const dependencyReceipts = createAtoBtoAGraph();

  for (const receipt of dependencyReceipts) {
    const verification = b4ReceiptApi.verifyReceiptV0(receipt);
    ok(verification.ok);
  }

  const beforeReceiptCount = reactor.receipts().length;
  const result = reactor.ingest({
    kind: "real-input",
    evidence: [
      {
        source_id: SOURCE_ID,
        content_hash: EVIDENCE_HASH,
      },
    ],
    dependency_receipts: dependencyReceipts,
  });
  const receiptsAfterIngest = reactor.receipts();
  const receiptsAppended = receiptsAfterIngest.length - beforeReceiptCount;

  equal(result.accepted, true);
  equal(result.outcome, "blocked-escalation-receipt");
  equal(receiptsAppended, 1);
  equal(modelRequests.length, 0);

  const blockedReceipt = receiptsAfterIngest.at(-1);
  ok(blockedReceipt !== undefined);

  const blockedVerification = b4ReceiptApi.verifyReceiptV0(blockedReceipt);
  ok(blockedVerification.ok);
  equal(result.receipt_hash, blockedVerification.content_hash);
  equal(blockedReceipt.verdict.status, "blocked");
  equal(blockedReceipt.verdict.blocked?.reason, "cycle-detected");
  equal(blockedReceipt.composition.cycle_checked, true);
  equal(blockedReceipt.cost.tokens.fresh, 0);
  equal(blockedReceipt.cost.tokens.reused, 0);
});

function createPublicB4Reactor(input: ReactorCreateInputV0): ReactorSdkV0 {
  return b4RuntimeApi.createReactor(input);
}

function loadB4RuntimeApi(): PublicB4ReactorRuntimeApiV0 {
  const sdkSurface = requireReactorSubpathSurface("sdk");

  if (typeof sdkSurface["createReactor"] !== "function") {
    throw new Error("B4 reactor SDK createReactor export is missing");
  }

  return {
    createReactor:
      sdkSurface["createReactor"] as PublicB4ReactorRuntimeApiV0["createReactor"],
  };
}

function loadB4ReceiptApi(): PublicB4ReceiptApiV0 {
  const receiptSurface = requireReactorSubpathSurface("receipt");

  if (typeof receiptSurface["createReceiptV0"] !== "function") {
    throw new Error("B4 reactor receipt createReceiptV0 export is missing");
  }
  if (typeof receiptSurface["verifyReceiptV0"] !== "function") {
    throw new Error("B4 reactor receipt verifyReceiptV0 export is missing");
  }

  return {
    createReceiptV0:
      receiptSurface["createReceiptV0"] as PublicB4ReceiptApiV0["createReceiptV0"],
    verifyReceiptV0:
      receiptSurface["verifyReceiptV0"] as PublicB4ReceiptApiV0["verifyReceiptV0"],
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

function createAtoBtoAGraph(): readonly ReceiptV0[] {
  const priorAReceipt = createDependencyReceipt({
    responsibility_id: GRAPH_A_ID,
    contract_revision: CONTRACT_A,
    evidence_hash: EVIDENCE_A_PRIOR,
    as_of: "2026-05-19T15:00:00.000Z",
    consumed_receipts: [],
  });
  const bReceipt = createDependencyReceipt({
    responsibility_id: GRAPH_B_ID,
    contract_revision: CONTRACT_B,
    evidence_hash: EVIDENCE_B,
    as_of: "2026-05-19T15:05:00.000Z",
    consumed_receipts: [pinFromReceipt(priorAReceipt)],
  });
  const cyclicAReceipt = createDependencyReceipt({
    responsibility_id: GRAPH_A_ID,
    contract_revision: CONTRACT_A,
    evidence_hash: EVIDENCE_A_CYCLIC,
    as_of: "2026-05-19T15:10:00.000Z",
    consumed_receipts: [pinFromReceipt(bReceipt)],
  });

  return [cyclicAReceipt, bReceipt, priorAReceipt];
}

function createDependencyReceipt(input: {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly evidence_hash: ContentHashV0;
  readonly as_of: string;
  readonly consumed_receipts: readonly ConsumedReceiptPinV0[];
}): ReceiptV0 {
  const receiptInput: ReceiptV0Input = {
    core: {
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      event_cause: "real-input",
      memo_key: `b4-cycle-dependency:${input.responsibility_id}:${input.evidence_hash}`,
      evidence_input_ids: [input.evidence_hash],
      as_of: input.as_of,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "Cradle B4 deterministic dependency receipt",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.91,
        derivation_method: "cradle-b4-deterministic-fixture",
        calibration_grade: "none",
        label_source: "cradle-b4-cycle-detection",
      },
    },
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck: NEXT_FORECAST_RECHECK,
      ...(input.consumed_receipts.length === 0
        ? {}
        : {
            transitive_freshness_policy_ref:
              "policy://cradle.b4.cycle-detection@seed#transitive-freshness",
            consumed_freshness_evaluated: input.consumed_receipts.map((pin) => ({
              receipt_hash: pin.upstream_content_hash,
              next_forecast_recheck: NEXT_FORECAST_RECHECK,
              staleness_outcome: "fresh" as const,
            })),
          }),
    },
    composition: {
      consumed_receipts: input.consumed_receipts,
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "b4-deterministic-dependency-fixture",
      role: "judge",
      tags: ["b4-cycle-detection", "dependency-fixture"],
      responsibility_id: input.responsibility_id,
      run_id: `b4-cycle-dependency-${input.as_of}`,
      as_of: input.as_of,
      tokens: { fresh: 1, reused: 0 },
      surprise_cause: "real-input",
    },
  };

  return b4ReceiptApi.createReceiptV0(receiptInput);
}

function pinFromReceipt(receipt: ReceiptV0): ConsumedReceiptPinV0 {
  return {
    upstream_content_hash: receipt.content_hash,
    contract_revision: receipt.core.contract_revision,
    acceptable_signer_set: ["none"],
  };
}

function createB4Adapters(input: {
  readonly receipts: ReceiptV0[];
  readonly modelRequests: ReactorModelGatewayRequestV0[];
}): ReactorAdaptersV0 {
  let registry = createB4Registry();

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
              derivation_method: "cradle-b4-model-should-not-run",
              calibration_grade: "none",
              label_source: "cradle-b4-cycle-detection",
            },
            cost_tags: {
              tags: ["b4-cycle-detection"],
            },
          },
          usage: {
            provider: "cradle",
            model: "b4-shallow-judge-should-not-run",
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

function createB4Registry(): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    contract_summary: {
      summary: "B4 cycle detection responsibility.",
      source_contract_revision: CONTRACT_HASH,
      projection_hash: PROJECTION_HASH,
    },
    policy_artifact_id: POLICY_NAMESPACE,
    policy_artifact_identity: POLICY_NAMESPACE,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    compiled_evidence_plan: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      policy_artifact_namespace: POLICY_NAMESPACE,
      policy_artifact_revision: POLICY_REVISION,
      plan_revision: "b4-cycle-detection-plan",
      as_of: "2026-05-19T15:30:00.000Z",
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
      memo_key: "b4-cycle-detection-registry-seed",
      evidence_input_ids: [EVIDENCE_HASH],
      next_evidence_recheck: NEXT_FORECAST_RECHECK,
      next_plan_recheck: "2026-05-21T16:00:00.000Z",
    },
  };
}
