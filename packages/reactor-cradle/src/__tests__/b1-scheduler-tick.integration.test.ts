import { deepEqual, equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import type { CompiledEvidencePlan } from "@openprose/reactor/evidence-plan";
import type {
  AuthoredPolicyArtifactV0,
  PolicyLiveObservableV0,
} from "@openprose/reactor/policy";
import type {
  ContentHashV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorAdaptersV0,
  ReactorConnectorRequestV0,
  ReactorConnectorResponseV0,
  ReactorCreateInputV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkV0,
  ReactorTickResultV0,
} from "@openprose/reactor/sdk";
import { VirtualClock } from "../doubles/clock";

interface PublicB1ReactorRuntimeApiV0 {
  readonly createReactor: (input: ReactorCreateInputV0) => ReactorSdkV0;
}

interface PublicB1PolicyApiV0 {
  readonly validatePolicyArtifactV0: (value: unknown) => {
    readonly ok: boolean;
    readonly bytes?: string;
    readonly content_hash?: ContentHashV0;
    readonly errors?: readonly string[];
  };
}

const INITIAL_AS_OF = "2026-05-18T12:14:00.000Z";
const DUE_AS_OF = "2026-05-18T12:15:00.000Z";
const NEXT_PLAN_RECHECK = "2026-05-18T18:00:00.000Z";
const RESPONSIBILITY_ID = "responsibility.b1-scheduler-tick";
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const POLICY_NAMESPACE = "policy.b1.scheduler-tick";
const POLICY_REVISION = "1";
const b1RuntimeApi = loadB1RuntimeApi();
const b1PolicyApi = loadB1PolicyApi();

test(
  "B1 scheduler tick sleeps before due time and writes a forecast receipt at due time",
  () => {
    const clock = new VirtualClock(INITIAL_AS_OF);
    const connectorReads: ReactorConnectorRequestV0[] = [];
    const modelRequests: ReactorModelGatewayRequestV0[] = [];
    const reactor = createPublicB1Reactor({
      responsibility_id: RESPONSIBILITY_ID,
      adapters: createB1Adapters({
        clock,
        connectorReads,
        modelRequests,
      }),
    });

    const beforeDue = reactor.tick();

    equal(beforeDue.accepted, true);
    equal(beforeDue.responsibility_id, RESPONSIBILITY_ID);
    equal(beforeDue.as_of, INITIAL_AS_OF);
    equal(beforeDue.outcome, "no-work");
    equal(beforeDue.receipts_appended, 0);
    deepEqual(beforeDue.receipt_hashes, []);
    equal(beforeDue.next_due_at, DUE_AS_OF);
    deepEqual(beforeDue.due_rechecks, []);
    equal(reactor.receipts().length, 0);
    equal(connectorReads.length, 0);
    equal(modelRequests.length, 0);

    clock.set(DUE_AS_OF);

    const due = reactor.tick();

    equal(due.accepted, true);
    equal(due.responsibility_id, RESPONSIBILITY_ID);
    equal(due.as_of, DUE_AS_OF);
    equal(due.outcome, "rechecks-completed");
    equal(due.receipts_appended, 1);
    deepEqual(due.due_rechecks, ["evidence-age"]);
    deepEqual(
      due.recheck_results?.map((result) => result.outcome),
      ["forecast-recheck-receipt"],
    );
    equal(connectorReads.length, 1);
    deepEqual(connectorReads[0], {
      source_id: "incident-feed",
      as_of: DUE_AS_OF,
    });
    equal(modelRequests.length, 1);

    const receipts = reactor.receipts();
    equal(receipts.length, 1);
    const receipt = receipts[0];
    ok(receipt);
    deepEqual(due.receipt_hashes, [receipt.content_hash]);
    equal(receipt.core.responsibility_id, RESPONSIBILITY_ID);
    equal(receipt.core.contract_revision, CONTRACT_HASH);
    equal(receipt.core.event_cause, "forecast-recheck");
    equal(receipt.core.recheck_kind, "evidence-age");
    equal(receipt.core.as_of, DUE_AS_OF);
    equal(receipt.cost.surprise_cause, "forecast-recheck");
    equal(receipt.cost.provider, "cradle");
    equal(receipt.cost.model, "b1-scheduler-tick-shallow");
    equal(receipt.cost.tokens.fresh, 9);
    equal(receipt.cost.tokens.reused, 1);
    ok(receipt.cost.tags.includes("forecast-recheck"));
    ok(receipt.cost.tags.includes("evidence-age"));
    equal(receipt.freshness.next_forecast_recheck, NEXT_PLAN_RECHECK);

    const duplicateDue = reactor.tick();

    equal(duplicateDue.accepted, true);
    equal(duplicateDue.outcome, "no-work");
    equal(duplicateDue.receipts_appended, 0);
    deepEqual(duplicateDue.receipt_hashes, []);
    equal(duplicateDue.next_due_at, NEXT_PLAN_RECHECK);
    deepEqual(duplicateDue.due_rechecks, []);
    equal(reactor.receipts().length, 1);
    equal(connectorReads.length, 1);
    equal(modelRequests.length, 1);
  },
);

function createPublicB1Reactor(
  input: ReactorCreateInputV0,
): ReactorSdkV0 & { readonly tick: () => ReactorTickResultV0 } {
  const api = b1RuntimeApi;

  return api.createReactor(input);
}

function loadB1RuntimeApi(): PublicB1ReactorRuntimeApiV0 {
  const sdkSurface = requireReactorSdkSurface();

  if (typeof sdkSurface["createReactor"] !== "function") {
    throw new Error("B1 reactor SDK createReactor export is missing");
  }

  return {
    createReactor:
      sdkSurface["createReactor"] as PublicB1ReactorRuntimeApiV0["createReactor"],
  };
}

function requireReactorSdkSurface(): Record<string, unknown> {
  return requireReactorSubpathSurface("sdk");
}

function loadB1PolicyApi(): PublicB1PolicyApiV0 {
  const policySurface = requireReactorSubpathSurface("policy");

  if (typeof policySurface["validatePolicyArtifactV0"] !== "function") {
    throw new Error("B1 reactor policy validatePolicyArtifactV0 export is missing");
  }

  return {
    validatePolicyArtifactV0:
      policySurface["validatePolicyArtifactV0"] as PublicB1PolicyApiV0["validatePolicyArtifactV0"],
  };
}

function requireReactorSubpathSurface(subpath: "policy" | "sdk"): Record<string, unknown> {
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

function createB1Adapters(input: {
  readonly clock: VirtualClock;
  readonly connectorReads?: ReactorConnectorRequestV0[];
  readonly modelRequests?: ReactorModelGatewayRequestV0[];
}): ReactorAdaptersV0 {
  const receipts: ReceiptV0[] = [];
  let registry = createB1Registry();

  return {
    clock: input.clock,
    storage: {
      appendReceipt(receipt): void {
        receipts.push(receipt);
      },
      listReceipts(): readonly ReceiptV0[] {
        return [...receipts];
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
        input.modelRequests?.push(request);

        return createB1JudgeResponse();
      },
    },
    agentSdk: {
      launch: (request) => ({ payload: request.payload }),
    },
    sandbox: {
      run: () => ({ exit_code: 0, stdout: "", stderr: "" }),
    },
    connectors: {
      read(request): ReactorConnectorResponseV0 {
        input.connectorReads?.push(request);

        return {
          payload: {
            source_id: request.source_id,
            status: "quiet",
            revision: "b1-static-observation",
          },
        };
      },
    },
    eventSink: {
      emit: () => {},
    },
  };
}

function createB1Registry(): ReactorRegistrySnapshotV0 {
  const policy = createB1PolicyArtifactBytes();

  return {
    contract_revision: CONTRACT_HASH,
    contract_summary: {
      summary: "B1 scheduler tick responsibility.",
      source_contract_revision: CONTRACT_HASH,
      projection_hash:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as ContentHashV0,
    },
    policy_artifact_id: POLICY_NAMESPACE,
    policy_artifact_identity: POLICY_NAMESPACE,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_bytes: policy.bytes,
    policy_artifact_content_hash: policy.content_hash,
    last_policy_revalidated_at: "2026-05-18T12:00:00.000Z",
    last_recompile_at: "2026-05-18T12:00:00.000Z",
    last_policy_recompile_at: "2026-05-18T12:00:00.000Z",
    last_unforced_deep_at: "2026-05-18T12:00:00.000Z",
    compiled_evidence_plan: createB1CompiledEvidencePlan(),
    forecast_schedule: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: "b1-scheduler-tick-forecast-seed",
      evidence_input_ids: [],
      next_evidence_recheck: DUE_AS_OF,
      next_plan_recheck: NEXT_PLAN_RECHECK,
    },
  };
}

function createB1PolicyArtifactBytes(): {
  readonly bytes: string;
  readonly content_hash: ContentHashV0;
} {
  const artifact: AuthoredPolicyArtifactV0 = {
    schema: "openprose.reactor.policy-artifact",
    v: 0,
    responsibility_id: RESPONSIBILITY_ID,
    registry_id: POLICY_NAMESPACE,
    policy_revision: POLICY_REVISION,
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    cadence: {
      shallow_recheck_ms: 900000,
      plan_audit_ms: 21600000,
      deep_revalidation_ms: 86400000,
    },
    hysteresis: {
      min_recompile_interval_ms: 3600000,
      enter_degraded_threshold: 0.22,
      exit_degraded_threshold: 0.11,
      warmup_judged_activations: 8,
    },
    thresholds: {
      max_calibration_divergence_multiplier: 1.6,
      escalation_precision_floor: 0.82,
      backstop_deep_contradiction_count: 1,
      stale_brief_minutes: 45,
      fresh_tokens_per_day_ceiling: 999999,
    },
    transitive_freshness_function: { kind: "kernel-default" },
    falsification_predicate: {
      kind: "greater-than-or-equal",
      fact: "cost.fresh_tokens_per_maintained_day",
      value: 999999,
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "kernel.deep_shallow_contradiction_count_7d",
      value: 1,
    },
    provenance: {
      contract_revision: CONTRACT_HASH,
      receipt_history_summary_hash:
        "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as ContentHashV0,
      explored_receipt_hashes: [],
      history_query: {
        schema: "openprose.reactor.policy-author.history-query",
        v: 0,
        selected_receipt_hashes: [],
      },
    },
  };
  const validation = b1PolicyApi.validatePolicyArtifactV0(artifact);
  if (!validation.ok || validation.bytes === undefined || validation.content_hash === undefined) {
    throw new Error(
      `B1 fixture policy failed validation: ${(validation.errors ?? []).join("; ")}`,
    );
  }

  return {
    bytes: validation.bytes,
    content_hash: validation.content_hash,
  };
}

function createB1CompiledEvidencePlan(): CompiledEvidencePlan {
  return {
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    plan_revision: "b1-scheduler-tick-plan-1",
    as_of: "2026-05-18T12:00:00.000Z",
    evidence_order: "declared",
    sources: [
      {
        id: "incident-feed",
        kind: "adapter",
        required: true,
      },
    ],
  };
}

function createB1JudgeResponse(): ReactorModelGatewayResponseV0 {
  return {
    payload: {
      status: "up",
      confidence: {
        value: 0.88,
        derivation_method: "cradle-b1-deterministic-replay",
        calibration_grade: "none",
        label_source: "cradle-b1-scheduler-tick",
      },
      cost_tags: {
        tags: ["b1-scheduler-tick"],
      },
    },
    usage: {
      provider: "cradle",
      model: "b1-scheduler-tick-shallow",
      tokens: {
        fresh: 9,
        reused: 1,
      },
    },
  };
}

const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: "cost.fresh_tokens_per_maintained_day",
    source: "cost-ledger",
    description: "Fresh tokens per maintained day.",
  },
  {
    id: "kernel.deep_shallow_contradiction_count_7d",
    source: "kernel-backstop",
    description: "Deep/shallow contradiction count.",
  },
];
