import { deepEqual, equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import type { CompiledEvidencePlan } from "@openprose/reactor/evidence-plan";
import type {
  AuthoredPolicyArtifactV0,
  PolicyAuthorRequestPayloadV0,
  PolicyLiveObservableV0,
} from "@openprose/reactor/policy";
import type {
  ContentHashV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorAdaptersV0,
  ReactorAgentRequestV0,
  ReactorConnectorRequestV0,
  ReactorConnectorResponseV0,
  ReactorCreateInputV0,
  ReactorIngestResultV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorPolicyRecompileTickResultV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkV0,
  ReactorTickResultV0,
} from "@openprose/reactor/sdk";
import { VirtualClock } from "../doubles/clock";

interface PublicB2ReactorRuntimeApiV0 {
  readonly createReactor: (input: ReactorCreateInputV0) => ReactorSdkV0;
}

interface PublicB2PolicyApiV0 {
  readonly validatePolicyArtifactV0: (value: unknown) => {
    readonly ok: boolean;
    readonly bytes?: string;
    readonly content_hash?: ContentHashV0;
    readonly errors?: readonly string[];
  };
}

interface ReactorB2TickResultV0 extends ReactorTickResultV0 {
  readonly policy_recompile?: ReactorPolicyRecompileTickResultV0;
}

const INITIAL_AS_OF = "2026-05-18T11:45:00.000Z";
const DUE_AS_OF = "2026-05-18T12:00:00.000Z";
const NEXT_PLAN_RECHECK = "2026-05-19T12:00:00.000Z";
const LAST_POLICY_REVALIDATED_AT = "2026-05-18T10:00:00.000Z";
const LAST_UNFORCED_DEEP_AT = "2026-05-18T10:00:00.000Z";
const LAST_RECOMPILE_ALLOWED_AT = "2026-05-18T10:30:00.000Z";
const LAST_RECOMPILE_RECENT_AT = "2026-05-18T11:30:00.000Z";
const MIN_RECOMPILE_INTERVAL_MS = 60 * 60 * 1000;
const RESPONSIBILITY_ID = "responsibility.b2-auto-recompile";
const CONTRACT_SUMMARY =
  "The incident channel has a current, accurate briefing.";
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const HISTORY_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const SEED_EVIDENCE_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const TICK_EVIDENCE_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as ContentHashV0;
const PROJECTION_HASH =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as ContentHashV0;
const POLICY_NAMESPACE = "policy.b2.auto-recompile";
const POLICY_REVISION = "policy.b2.seed.1";
const RECOMPILED_POLICY_REVISION = "policy.b2.recompiled.1";
const SOURCE_ID = "incident-feed";
const b2RuntimeApi = loadB2RuntimeApi();
const b2PolicyApi = loadB2PolicyApi();

test(
  "B2 tick auto-recompiles on drift and delays the same evidence inside the min interval",
  () => {
    const requested = runB2AutoRecompileCase({
      last_recompile_at: LAST_RECOMPILE_ALLOWED_AT,
    });

    equal(requested.seed.accepted, true);
    equal(requested.seed.outcome, "fresh-judge-receipt");
    equal(requested.tick.accepted, true);
    equal(requested.tick.outcome, "rechecks-completed");
    equal(requested.tick.receipts_appended, 1);
    deepEqual(requested.tick.due_rechecks, ["evidence-age"]);
    equal(requested.registry_before_tick.policy_artifact_revision, POLICY_REVISION);
    equal(
      requested.registry_after_tick.policy_artifact_revision,
      RECOMPILED_POLICY_REVISION,
    );
    equal(requested.agentRequests.length, 2);

    const requestedRecompile = readB2PolicyRecompileReport(requested.tick);
    equal(requestedRecompile.policy_artifact_revision_before, POLICY_REVISION);
    equal(
      requestedRecompile.policy_artifact_revision_after,
      RECOMPILED_POLICY_REVISION,
    );
    equal(requestedRecompile.compiled_evidence_plan_strategy, "carried-forward");
    equal(requestedRecompile.decision.outcome, "recompile-requested");
    equal(requestedRecompile.decision.drift.outcome, "tripped");
    const requestedExecution = requestedRecompile.execution;
    ok(requestedExecution !== undefined);
    equal(requestedExecution.outcome, "recompile-authored");
    if (requestedExecution.outcome === "recompile-authored") {
      equal(
        requestedExecution.registry.policy_artifact_revision,
        RECOMPILED_POLICY_REVISION,
      );
    }
    for (const receiptHash of requested.tick.receipt_hashes) {
      ok(requestedRecompile.decision.evidence_receipt_hashes.includes(receiptHash));
    }

    const delayed = runB2AutoRecompileCase({
      last_recompile_at: LAST_RECOMPILE_RECENT_AT,
    });

    equal(delayed.seed.accepted, true);
    equal(delayed.seed.outcome, "fresh-judge-receipt");
    equal(delayed.tick.accepted, true);
    equal(delayed.tick.outcome, "rechecks-completed");
    equal(delayed.tick.receipts_appended, 1);
    equal(delayed.registry_before_tick.policy_artifact_revision, POLICY_REVISION);
    equal(delayed.registry_after_tick.policy_artifact_revision, POLICY_REVISION);
    equal(delayed.agentRequests.length, 0);

    const delayedRecompile = readB2PolicyRecompileReport(delayed.tick);
    equal(delayedRecompile.policy_artifact_revision_before, POLICY_REVISION);
    equal(
      delayedRecompile.policy_artifact_revision_after ?? POLICY_REVISION,
      POLICY_REVISION,
    );
    equal(delayedRecompile.decision.outcome, "recompile-delayed");
    equal(delayedRecompile.decision.delayed_by, "min_recompile_interval");
    equal(delayedRecompile.decision.retry_after_ms, 30 * 60 * 1000);
    equal(delayedRecompile.decision.drift.outcome, "tripped");
    if (delayedRecompile.execution !== undefined) {
      equal(delayedRecompile.execution.outcome, "not-executed");
    }
    deepEqual(
      delayedRecompile.decision.evidence_receipt_hashes,
      requestedRecompile.decision.evidence_receipt_hashes,
    );
  },
);

function runB2AutoRecompileCase(input: {
  readonly last_recompile_at: string;
}): {
  readonly seed: ReactorIngestResultV0;
  readonly tick: ReactorB2TickResultV0;
  readonly registry_before_tick: ReactorRegistrySnapshotV0;
  readonly registry_after_tick: ReactorRegistrySnapshotV0;
  readonly agentRequests: readonly ReactorAgentRequestV0[];
} {
  const clock = new VirtualClock(INITIAL_AS_OF);
  const agentRequests: ReactorAgentRequestV0[] = [];
  const reactor = createPublicB2Reactor({
    responsibility_id: RESPONSIBILITY_ID,
    adapters: createB2Adapters({
      clock,
      last_recompile_at: input.last_recompile_at,
      agentRequests,
    }),
  });

  const seed = reactor.ingest({
    kind: "real-input",
    evidence: [
      {
        source_id: SOURCE_ID,
        content_hash: SEED_EVIDENCE_HASH,
      },
    ],
  });
  equal(reactor.receipts().length, 1);

  const registryBeforeTick = reactor.registry();
  clock.set(DUE_AS_OF);

  const tick = reactor.tick();
  equal(reactor.receipts().length, 2);

  return {
    seed,
    tick,
    registry_before_tick: registryBeforeTick,
    registry_after_tick: reactor.registry(),
    agentRequests,
  };
}

function createPublicB2Reactor(
  input: ReactorCreateInputV0,
): ReactorSdkV0 & { readonly tick: () => ReactorB2TickResultV0 } {
  const api = b2RuntimeApi;

  return api.createReactor(input) as ReactorSdkV0 & {
    readonly tick: () => ReactorB2TickResultV0;
  };
}

function loadB2RuntimeApi(): PublicB2ReactorRuntimeApiV0 {
  const sdkSurface = requireReactorSdkSurface();

  if (typeof sdkSurface["createReactor"] !== "function") {
    throw new Error("B2 reactor SDK createReactor export is missing");
  }

  return {
    createReactor:
      sdkSurface["createReactor"] as PublicB2ReactorRuntimeApiV0["createReactor"],
  };
}

function requireReactorSdkSurface(): Record<string, unknown> {
  return requireReactorSubpathSurface("sdk");
}

function loadB2PolicyApi(): PublicB2PolicyApiV0 {
  const policySurface = requireReactorSubpathSurface("policy");

  if (typeof policySurface["validatePolicyArtifactV0"] !== "function") {
    throw new Error("B2 reactor policy validatePolicyArtifactV0 export is missing");
  }

  return {
    validatePolicyArtifactV0:
      policySurface["validatePolicyArtifactV0"] as PublicB2PolicyApiV0["validatePolicyArtifactV0"],
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

function createB2Adapters(input: {
  readonly clock: VirtualClock;
  readonly last_recompile_at: string;
  readonly agentRequests: ReactorAgentRequestV0[];
  readonly connectorReads?: ReactorConnectorRequestV0[];
  readonly modelRequests?: ReactorModelGatewayRequestV0[];
}): ReactorAdaptersV0 {
  const receipts: ReceiptV0[] = [];
  let registry = createB2Registry(input.last_recompile_at);
  let modelInvocationCount = 0;

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
        modelInvocationCount += 1;

        return createB2JudgeResponse(modelInvocationCount);
      },
    },
    agentSdk: {
      launch(request) {
        input.agentRequests.push(request);

        return createB2PolicyAuthorResponse(request);
      },
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
            status: "drifted",
            revision: "b2-drifted-observation",
            content_hash: TICK_EVIDENCE_HASH,
          },
          content_hash: TICK_EVIDENCE_HASH,
        };
      },
    },
    eventSink: {
      emit: () => {},
    },
  };
}

function createB2Registry(lastRecompileAt: string): ReactorRegistrySnapshotV0 {
  const activePolicy = createPolicyArtifact(POLICY_REVISION);
  const policyBytes = policyArtifactBytes(activePolicy);

  return {
    contract_revision: CONTRACT_HASH,
    contract_summary: CONTRACT_SUMMARY,
    contract_summary_projection: {
      summary: CONTRACT_SUMMARY,
      source_contract_revision: CONTRACT_HASH,
      projection_hash: PROJECTION_HASH,
    },
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    policy_artifact_id: POLICY_NAMESPACE,
    policy_artifact_identity: POLICY_NAMESPACE,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_bytes: policyBytes.bytes,
    policy_artifact_content_hash: policyBytes.content_hash,
    last_policy_revalidated_at: LAST_POLICY_REVALIDATED_AT,
    last_recompile_at: lastRecompileAt,
    last_unforced_deep_at: LAST_UNFORCED_DEEP_AT,
    policy_warmup_judged_activations: 8,
    warmup_judged_activations: 8,
    compiled_evidence_plan: createB2CompiledEvidencePlan(),
    forecast_schedule: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: "b2-auto-recompile-forecast-seed",
      evidence_input_ids: [],
      next_evidence_recheck: DUE_AS_OF,
      next_plan_recheck: NEXT_PLAN_RECHECK,
    },
  };
}

function createB2CompiledEvidencePlan(): CompiledEvidencePlan {
  return {
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    plan_revision: "b2-auto-recompile-plan-1",
    as_of: "2026-05-18T10:00:00.000Z",
    evidence_order: "declared",
    sources: [
      {
        id: SOURCE_ID,
        kind: "adapter",
        required: true,
      },
    ],
  };
}

function createB2JudgeResponse(
  invocationCount: number,
): ReactorModelGatewayResponseV0 {
  return {
    payload: {
      status: "up",
      confidence: {
        value: 0.88,
        derivation_method: "cradle-b2-deterministic-replay",
        calibration_grade: "none",
        label_source: "cradle-b2-auto-recompile",
      },
      cost_tags: {
        tags: ["b2-auto-recompile"],
      },
    },
    usage: {
      provider: "cradle",
      model: "b2-auto-recompile-shallow",
      tokens: {
        fresh: invocationCount === 1 ? 10 : 700,
        reused: invocationCount === 1 ? 2 : 0,
      },
    },
  };
}

function createB2PolicyAuthorResponse(request: ReactorAgentRequestV0): {
  readonly payload: unknown;
} {
  const payload = request.payload as PolicyAuthorRequestPayloadV0;

  if (payload.step === "history-query") {
    return {
      payload: {
        schema: "openprose.reactor.policy-author.history-query",
        v: 0,
        selected_receipt_hashes: payload.receipt_history_summary.map(
          (receipt) => receipt.content_hash,
        ),
        rationale: "Cradle B2 selects all drift evidence for recompile.",
      },
    };
  }

  return {
    payload: {
      schema: "openprose.reactor.policy-author.artifact-response",
      v: 0,
      artifact: createPolicyAuthorArtifactResponse(RECOMPILED_POLICY_REVISION),
    },
  };
}

function createPolicyAuthorArtifactResponse(
  policyRevision: string,
): Omit<
  AuthoredPolicyArtifactV0,
  "schema" | "v" | "no_anchor" | "live_observables" | "provenance"
> {
  const artifact = createPolicyArtifact(policyRevision);
  const response: Omit<
    AuthoredPolicyArtifactV0,
    | "schema"
    | "v"
    | "no_anchor"
    | "live_observables"
    | "provenance"
    | "backstop_divergence_predicate"
  > = {
    responsibility_id: artifact.responsibility_id,
    registry_id: artifact.registry_id,
    policy_revision: artifact.policy_revision,
    cadence: artifact.cadence,
    hysteresis: artifact.hysteresis,
    thresholds: artifact.thresholds,
    transitive_freshness_function: artifact.transitive_freshness_function,
    falsification_predicate: artifact.falsification_predicate,
  };

  return artifact.backstop_divergence_predicate === undefined
    ? response
    : {
        ...response,
        backstop_divergence_predicate: artifact.backstop_divergence_predicate,
      };
}

function createPolicyArtifact(policyRevision: string): AuthoredPolicyArtifactV0 {
  return {
    schema: "openprose.reactor.policy-artifact",
    v: 0,
    responsibility_id: RESPONSIBILITY_ID,
    registry_id: POLICY_NAMESPACE,
    policy_revision: policyRevision,
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    cadence: {
      shallow_recheck_ms: 900000,
      plan_audit_ms: 21600000,
      deep_revalidation_ms: 86400000,
    },
    hysteresis: {
      min_recompile_interval_ms: MIN_RECOMPILE_INTERVAL_MS,
      enter_degraded_threshold: 0.22,
      exit_degraded_threshold: 0.11,
      warmup_judged_activations: 8,
    },
    thresholds: {
      max_calibration_divergence_multiplier: 1.6,
      escalation_precision_floor: 0.82,
      backstop_deep_contradiction_count: 1,
      stale_brief_minutes: 45,
      fresh_tokens_per_day_ceiling: 1200,
    },
    transitive_freshness_function: { kind: "kernel-default" },
    falsification_predicate: {
      kind: "greater-than-or-equal",
      fact: "cost.fresh_tokens_per_maintained_day",
      value: 300,
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "kernel.deep_shallow_contradiction_count_7d",
      value: 1,
    },
    provenance: {
      contract_revision: CONTRACT_HASH,
      receipt_history_summary_hash: HISTORY_HASH,
      explored_receipt_hashes: [HISTORY_HASH],
      history_query: {
        schema: "openprose.reactor.policy-author.history-query",
        v: 0,
        selected_receipt_hashes: [HISTORY_HASH],
      },
    },
  };
}

function policyArtifactBytes(policy: AuthoredPolicyArtifactV0): {
  readonly bytes: string;
  readonly content_hash: ContentHashV0;
} {
  const validation = b2PolicyApi.validatePolicyArtifactV0(policy);
  if (!validation.ok || validation.bytes === undefined || validation.content_hash === undefined) {
    throw new Error(
      `B2 fixture policy failed validation: ${(validation.errors ?? []).join("; ")}`,
    );
  }

  return {
    bytes: validation.bytes,
    content_hash: validation.content_hash,
  };
}

function readB2PolicyRecompileReport(
  result: ReactorB2TickResultV0,
): ReactorPolicyRecompileTickResultV0 {
  if (result.policy_recompile === undefined) {
    throw new Error("B2 tick result must report policy_recompile");
  }

  return result.policy_recompile;
}

const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: "receipt.escalation_precision_7d",
    source: "receipt-log",
    description: "Seven-day precision of escalations later confirmed as needed.",
  },
  {
    id: "cost.fresh_tokens_per_maintained_day",
    source: "cost-ledger",
    description: "Fresh policy and judge tokens per maintained briefing day.",
  },
  {
    id: "kernel.deep_shallow_contradiction_count_7d",
    source: "kernel-backstop",
    description: "Forced deep revalidations that contradicted shallow history.",
  },
];
