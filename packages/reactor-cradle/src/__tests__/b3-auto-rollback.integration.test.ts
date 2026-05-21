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
  ReceiptV0Input,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorAdaptersV0,
  ReactorAgentRequestV0,
  ReactorConnectorRequestV0,
  ReactorConnectorResponseV0,
  ReactorCreateInputV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorPolicyRecompileTickResultV0,
  ReactorPolicyRollbackTickResultV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkV0,
  ReactorTickResultV0,
} from "@openprose/reactor/sdk";
import { VirtualClock } from "../doubles/clock";

interface PublicB3ReactorRuntimeApiV0 {
  readonly createReactor: (input: ReactorCreateInputV0) => ReactorSdkV0;
}

interface PublicB3PolicyApiV0 {
  readonly validatePolicyArtifactV0: (value: unknown) => {
    readonly ok: boolean;
    readonly bytes?: string;
    readonly content_hash?: ContentHashV0;
    readonly errors?: readonly string[];
  };
}

interface PublicB3ReceiptApiV0 {
  readonly createReceiptV0: (input: ReceiptV0Input) => ReceiptV0;
}

interface ReactorB3TickResultV0 extends ReactorTickResultV0 {
  readonly policy_recompile?: ReactorPolicyRecompileTickResultV0;
  readonly policy_rollback?: ReactorPolicyRollbackTickResultV0;
}

interface B3PolicyTripSummaryV0 {
  readonly policy_revision: string;
  readonly judged_activations_before_trip: number;
  readonly activated_at: string;
  readonly first_trip_at: string;
}

const INITIAL_AS_OF = "2026-05-19T07:59:00.000Z";
const FRESH_INSTALL_AS_OF = "2026-05-19T08:00:00.000Z";
const FRESH_SELF_TRIP_AS_OF = "2026-05-19T12:00:00.000Z";
const LAST_KNOWN_GOOD_ACTIVATED_AT = "2026-05-19T07:45:00.000Z";
const LAST_KNOWN_GOOD_FIRST_TRIP_AT = FRESH_INSTALL_AS_OF;
const LAST_POLICY_REVALIDATED_AT = "2026-05-19T06:30:00.000Z";
const LAST_RECOMPILE_AT = "2026-05-19T06:30:00.000Z";
const LAST_UNFORCED_DEEP_AT = "2026-05-19T06:30:00.000Z";
const MIN_RECOMPILE_INTERVAL_MS = 60 * 60 * 1000;
const RESPONSIBILITY_ID = "responsibility.b3-auto-rollback";
const CONTRACT_SUMMARY =
  "The incident channel has a current, accurate briefing.";
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const HISTORY_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const FIRST_TICK_EVIDENCE_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const SECOND_TICK_EVIDENCE_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as ContentHashV0;
const PROJECTION_HASH =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as ContentHashV0;
const POLICY_NAMESPACE = "policy.b3.auto-rollback";
const LAST_KNOWN_GOOD_REVISION = "policy.b3.last-known-good";
const FRESH_POLICY_REVISION = "policy.b3.fresh-authored";
const SOURCE_ID = "incident-feed";
const LAST_KNOWN_GOOD_ACTIVATIONS = 9;
const FRESH_POLICY_ACTIVATIONS = 1;
const SEEDED_LAST_KNOWN_GOOD_RECEIPTS = LAST_KNOWN_GOOD_ACTIVATIONS - 1;
const ROLLBACK_PROVIDER_NORM_SCHEMA =
  "openprose.reactor.policy-rollback.receipt";
const b3RuntimeApi = loadB3RuntimeApi();
const b3PolicyApi = loadB3PolicyApi();
const b3ReceiptApi = loadB3ReceiptApi();

test(
  "B3 tick rolls back a freshly authored policy that self-trips in fewer judged activations",
  () => {
    const clock = new VirtualClock(INITIAL_AS_OF);
    const agentRequests: ReactorAgentRequestV0[] = [];
    const connectorReads: ReactorConnectorRequestV0[] = [];
    const modelRequests: ReactorModelGatewayRequestV0[] = [];
    const reactor = createPublicB3Reactor({
      responsibility_id: RESPONSIBILITY_ID,
      adapters: createB3Adapters({
        clock,
        agentRequests,
        connectorReads,
        modelRequests,
      }),
    });

    equal(
      reactor.registry().policy_artifact_revision,
      LAST_KNOWN_GOOD_REVISION,
    );
    equal(reactor.receipts().length, SEEDED_LAST_KNOWN_GOOD_RECEIPTS);

    clock.set(FRESH_INSTALL_AS_OF);

    const installFresh = reactor.tick();

    equal(installFresh.accepted, true);
    equal(installFresh.outcome, "rechecks-completed");
    equal(installFresh.receipts_appended, 1);
    deepEqual(installFresh.due_rechecks, ["evidence-age"]);
    equal(reactor.receipts().length, LAST_KNOWN_GOOD_ACTIVATIONS);
    equal(
      reactor.registry().policy_artifact_revision,
      FRESH_POLICY_REVISION,
    );

    const recompile = readB3PolicyRecompileReport(installFresh);
    equal(
      recompile.policy_artifact_revision_before,
      LAST_KNOWN_GOOD_REVISION,
    );
    equal(recompile.policy_artifact_revision_after, FRESH_POLICY_REVISION);
    equal(recompile.decision.outcome, "recompile-requested");
    equal(recompile.execution?.outcome, "recompile-authored");
    equal(agentRequests.length, 2);
    equal(modelRequests.length, 1);

    const firstReceipt = reactor.receipts().at(-1);
    ok(firstReceipt !== undefined);
    equal(firstReceipt.core.recheck_kind, "evidence-age");
    ok(
      firstReceipt.cost.tags.includes(
        memoSourceTag(LAST_KNOWN_GOOD_REVISION),
      ),
    );

    clock.set(FRESH_SELF_TRIP_AS_OF);

    const rollback = reactor.tick();
    const registryAfterRollback = reactor.registry();
    const receiptsAfterRollback = reactor.receipts();

    equal(rollback.accepted, true);
    equal(rollback.outcome, "rechecks-completed");
    equal(rollback.receipts_appended, 2);
    deepEqual(rollback.due_rechecks, ["plan-age"]);
    equal(registryAfterRollback.policy_artifact_revision, LAST_KNOWN_GOOD_REVISION);
    equal(receiptsAfterRollback.length, LAST_KNOWN_GOOD_ACTIVATIONS + 2);
    equal(agentRequests.length, 2);
    equal(modelRequests.length, 2);

    const report = readB3PolicyRollbackReport(rollback);
    equal(
      readRequiredString(
        report,
        "policy_artifact_revision_before",
        "policy_rollback.policy_artifact_revision_before",
      ),
      FRESH_POLICY_REVISION,
    );
    equal(
      readRequiredString(
        report,
        "policy_artifact_revision_after",
        "policy_rollback.policy_artifact_revision_after",
      ),
      LAST_KNOWN_GOOD_REVISION,
    );

    const decision = readRequiredRecord(
      report["decision"],
      "policy_rollback.decision",
    );
    equal(
      readRequiredString(decision, "outcome", "policy_rollback.decision.outcome"),
      "rollback",
    );
    equal(
      readRequiredString(
        decision,
        "fresh_policy_revision",
        "policy_rollback.decision.fresh_policy_revision",
      ),
      FRESH_POLICY_REVISION,
    );
    equal(
      readRequiredString(
        decision,
        "last_known_good_revision",
        "policy_rollback.decision.last_known_good_revision",
      ),
      LAST_KNOWN_GOOD_REVISION,
    );
    equal(
      readRequiredString(
        decision,
        "target_policy_revision",
        "policy_rollback.decision.target_policy_revision",
      ),
      LAST_KNOWN_GOOD_REVISION,
    );
    equal(
      readRequiredNumber(
        report,
        "fresh_policy_judged_activations_before_trip",
        "policy_rollback.fresh_policy_judged_activations_before_trip",
      ),
      FRESH_POLICY_ACTIVATIONS,
    );
    equal(
      readRequiredNumber(
        report,
        "last_known_good_judged_activations_before_trip",
        "policy_rollback.last_known_good_judged_activations_before_trip",
      ),
      LAST_KNOWN_GOOD_ACTIVATIONS,
    );
    equal(
      readRequiredString(
        report,
        "fresh_policy_installed_at",
        "policy_rollback.fresh_policy_installed_at",
      ),
      FRESH_INSTALL_AS_OF,
    );
    equal(
      readRequiredNumber(
        decision,
        "fresh_policy_judged_activations_before_trip",
        "policy_rollback.decision.fresh_policy_judged_activations_before_trip",
      ),
      FRESH_POLICY_ACTIVATIONS,
    );
    equal(
      readRequiredNumber(
        decision,
        "last_known_good_judged_activations_before_trip",
        "policy_rollback.decision.last_known_good_judged_activations_before_trip",
      ),
      LAST_KNOWN_GOOD_ACTIVATIONS,
    );

    const freshPolicy: B3PolicyTripSummaryV0 = {
      policy_revision: FRESH_POLICY_REVISION,
      judged_activations_before_trip: FRESH_POLICY_ACTIVATIONS,
      activated_at: FRESH_INSTALL_AS_OF,
      first_trip_at: FRESH_SELF_TRIP_AS_OF,
    };
    const lastKnownGoodPolicy: B3PolicyTripSummaryV0 = {
      policy_revision: LAST_KNOWN_GOOD_REVISION,
      judged_activations_before_trip: LAST_KNOWN_GOOD_ACTIVATIONS,
      activated_at: LAST_KNOWN_GOOD_ACTIVATED_AT,
      first_trip_at: LAST_KNOWN_GOOD_FIRST_TRIP_AT,
    };
    assertEventVolumeNormalizedRollback(freshPolicy, lastKnownGoodPolicy);

    const rollbackReceipt = findRollbackReceipt(receiptsAfterRollback, report);
    ok(rollback.receipt_hashes.includes(rollbackReceipt.content_hash));
    equal(rollbackReceipt.core.as_of, FRESH_SELF_TRIP_AS_OF);
    equal(rollbackReceipt.cost.provider, "runtime");
    equal(rollbackReceipt.cost.model, "deterministic-policy-rollback");
    equal(rollbackReceipt.cost.tokens.fresh, 0);
    equal(rollbackReceipt.cost.tokens.reused, 0);

    const providerNorm = readRequiredRecord(
      rollbackReceipt.cost.provider_norm,
      "rollback receipt cost.provider_norm",
    );
    equal(
      readRequiredString(
        providerNorm,
        "schema",
        "rollback receipt cost.provider_norm.schema",
      ),
      ROLLBACK_PROVIDER_NORM_SCHEMA,
    );
    equal(
      readRequiredString(
        providerNorm,
        "fresh_policy_revision",
        "rollback receipt cost.provider_norm.fresh_policy_revision",
      ),
      FRESH_POLICY_REVISION,
    );
    equal(
      readRequiredString(
        providerNorm,
        "target_policy_revision",
        "rollback receipt cost.provider_norm.target_policy_revision",
      ),
      LAST_KNOWN_GOOD_REVISION,
    );
    equal(
      readRequiredNumber(
        providerNorm,
        "fresh_policy_judged_activations_before_trip",
        "rollback receipt cost.provider_norm.fresh_policy_judged_activations_before_trip",
      ),
      FRESH_POLICY_ACTIVATIONS,
    );
    equal(
      readRequiredNumber(
        providerNorm,
        "last_known_good_judged_activations_before_trip",
        "rollback receipt cost.provider_norm.last_known_good_judged_activations_before_trip",
      ),
      LAST_KNOWN_GOOD_ACTIVATIONS,
    );
    equal(
      readRequiredString(
        providerNorm,
        "self_trip_outcome",
        "rollback receipt cost.provider_norm.self_trip_outcome",
      ),
      "recompile-requested",
    );
  },
);

function createPublicB3Reactor(
  input: ReactorCreateInputV0,
): ReactorSdkV0 & { readonly tick: () => ReactorB3TickResultV0 } {
  const api = b3RuntimeApi;

  return api.createReactor(input) as ReactorSdkV0 & {
    readonly tick: () => ReactorB3TickResultV0;
  };
}

function loadB3RuntimeApi(): PublicB3ReactorRuntimeApiV0 {
  const sdkSurface = requireReactorSdkSurface();

  if (typeof sdkSurface["createReactor"] !== "function") {
    throw new Error("B3 reactor SDK createReactor export is missing");
  }

  return {
    createReactor:
      sdkSurface["createReactor"] as PublicB3ReactorRuntimeApiV0["createReactor"],
  };
}

function requireReactorSdkSurface(): Record<string, unknown> {
  return requireReactorSubpathSurface("sdk");
}

function loadB3PolicyApi(): PublicB3PolicyApiV0 {
  const policySurface = requireReactorSubpathSurface("policy");

  if (typeof policySurface["validatePolicyArtifactV0"] !== "function") {
    throw new Error("B3 reactor policy validatePolicyArtifactV0 export is missing");
  }

  return {
    validatePolicyArtifactV0:
      policySurface["validatePolicyArtifactV0"] as PublicB3PolicyApiV0["validatePolicyArtifactV0"],
  };
}

function loadB3ReceiptApi(): PublicB3ReceiptApiV0 {
  const receiptSurface = requireReactorSubpathSurface("receipt");

  if (typeof receiptSurface["createReceiptV0"] !== "function") {
    throw new Error("B3 reactor receipt createReceiptV0 export is missing");
  }

  return {
    createReceiptV0:
      receiptSurface["createReceiptV0"] as PublicB3ReceiptApiV0["createReceiptV0"],
  };
}

function requireReactorSubpathSurface(
  subpath: "policy" | "receipt" | "sdk",
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

function createB3Adapters(input: {
  readonly clock: VirtualClock;
  readonly agentRequests: ReactorAgentRequestV0[];
  readonly connectorReads: ReactorConnectorRequestV0[];
  readonly modelRequests: ReactorModelGatewayRequestV0[];
}): ReactorAdaptersV0 {
  const receipts: ReceiptV0[] = createLastKnownGoodReceiptHistory();
  let registry = createB3Registry();
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
        input.modelRequests.push(request);
        modelInvocationCount += 1;

        return createB3JudgeResponse(modelInvocationCount);
      },
    },
    agentSdk: {
      launch(request) {
        input.agentRequests.push(request);

        return createB3PolicyAuthorResponse(request);
      },
    },
    sandbox: {
      run: () => ({ exit_code: 0, stdout: "", stderr: "" }),
    },
    connectors: {
      read(request): ReactorConnectorResponseV0 {
        input.connectorReads.push(request);

        const contentHash =
          request.as_of === FRESH_INSTALL_AS_OF
            ? FIRST_TICK_EVIDENCE_HASH
            : SECOND_TICK_EVIDENCE_HASH;

        return {
          payload: {
            source_id: request.source_id,
            status: "drifted",
            revision:
              request.as_of === FRESH_INSTALL_AS_OF
                ? "b3-before-fresh-policy"
                : "b3-fresh-policy-self-trip",
            content_hash: contentHash,
          },
          content_hash: contentHash,
        };
      },
    },
    eventSink: {
      emit: () => {},
    },
  };
}

function createLastKnownGoodReceiptHistory(): ReceiptV0[] {
  return Array.from({ length: SEEDED_LAST_KNOWN_GOOD_RECEIPTS }, (_, index) =>
    createLastKnownGoodReceipt(index),
  );
}

function createLastKnownGoodReceipt(index: number): ReceiptV0 {
  const asOf = new Date(
    Date.parse(LAST_KNOWN_GOOD_ACTIVATED_AT) + index * 60 * 1000,
  ).toISOString();
  const evidenceInputId = contentHashFromIndex(index + 1);

  return b3ReceiptApi.createReceiptV0({
    core: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      event_cause: "forecast-recheck",
      recheck_kind: "evidence-age",
      memo_key: `b3-seeded-last-known-good:${index}`,
      evidence_input_ids: [evidenceInputId],
      as_of: asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "seeded last-known-good rollback fixture receipt",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.88,
        derivation_method: "cradle-b3-seeded-history",
        calibration_grade: "none",
        label_source: "cradle-b3-auto-rollback",
      },
    },
    freshness: {
      as_of: asOf,
      next_forecast_recheck: FRESH_INSTALL_AS_OF,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "b3-auto-rollback-seeded-last-known-good",
      role: "judge",
      tags: ["b3-auto-rollback", memoSourceTag(LAST_KNOWN_GOOD_REVISION)],
      responsibility_id: RESPONSIBILITY_ID,
      run_id: `b3-seeded-last-known-good-${index}`,
      as_of: asOf,
      tokens: { fresh: 1, reused: 0 },
      surprise_cause: "forecast-recheck",
    },
  });
}

function contentHashFromIndex(index: number): ContentHashV0 {
  return `sha256:${index.toString(16).padStart(64, "0")}` as ContentHashV0;
}

function createB3Registry(): ReactorRegistrySnapshotV0 {
  const activePolicy = createPolicyArtifact(
    LAST_KNOWN_GOOD_REVISION,
    "last-known-good",
  );
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
    policy_artifact_revision: LAST_KNOWN_GOOD_REVISION,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_bytes: policyBytes.bytes,
    policy_artifact_content_hash: policyBytes.content_hash,
    last_policy_revalidated_at: LAST_POLICY_REVALIDATED_AT,
    last_recompile_at: LAST_RECOMPILE_AT,
    last_policy_recompile_at: LAST_RECOMPILE_AT,
    last_unforced_deep_at: LAST_UNFORCED_DEEP_AT,
    policy_activated_at: LAST_KNOWN_GOOD_ACTIVATED_AT,
    policy_first_trip_at: LAST_KNOWN_GOOD_FIRST_TRIP_AT,
    policy_warmup_judged_activations: LAST_KNOWN_GOOD_ACTIVATIONS,
    policy_judged_activations_before_trip: LAST_KNOWN_GOOD_ACTIVATIONS,
    warmup_judged_activations: LAST_KNOWN_GOOD_ACTIVATIONS,
    last_known_good_policy_revision: LAST_KNOWN_GOOD_REVISION,
    last_known_good_judged_activations_before_trip:
      LAST_KNOWN_GOOD_ACTIVATIONS,
    last_known_good_activated_at: LAST_KNOWN_GOOD_ACTIVATED_AT,
    last_known_good_first_trip_at: LAST_KNOWN_GOOD_FIRST_TRIP_AT,
    compiled_evidence_plan: createB3CompiledEvidencePlan(
      LAST_KNOWN_GOOD_REVISION,
    ),
    forecast_schedule: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: "b3-auto-rollback-forecast-seed",
      evidence_input_ids: [],
      next_evidence_recheck: FRESH_INSTALL_AS_OF,
      next_plan_recheck: FRESH_SELF_TRIP_AS_OF,
    },
  };
}

function createB3CompiledEvidencePlan(policyRevision: string): CompiledEvidencePlan {
  return {
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: policyRevision,
    plan_revision: `b3-auto-rollback-plan:${policyRevision}`,
    as_of: LAST_POLICY_REVALIDATED_AT,
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

function createB3JudgeResponse(
  invocationCount: number,
): ReactorModelGatewayResponseV0 {
  return {
    payload: {
      status: "up",
      confidence: {
        value: 0.88,
        derivation_method: "cradle-b3-deterministic-replay",
        calibration_grade: "none",
        label_source: "cradle-b3-auto-rollback",
      },
      cost_tags: {
        tags: ["b3-auto-rollback"],
      },
    },
    usage: {
      provider: "cradle",
      model: "b3-auto-rollback-shallow",
      tokens: {
        fresh: invocationCount === 1 ? 10 : 700,
        reused: invocationCount === 1 ? 2 : 0,
      },
    },
  };
}

function createB3PolicyAuthorResponse(request: ReactorAgentRequestV0): {
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
        rationale: "Cradle B3 selects the fresh-install evidence for recompile.",
      },
    };
  }

  return {
    payload: {
      schema: "openprose.reactor.policy-author.artifact-response",
      v: 0,
      artifact: createPolicyAuthorArtifactResponse(FRESH_POLICY_REVISION),
    },
  };
}

function createPolicyAuthorArtifactResponse(
  policyRevision: string,
): Omit<
  AuthoredPolicyArtifactV0,
  "schema" | "v" | "no_anchor" | "live_observables" | "provenance"
> {
  const artifact = createPolicyArtifact(policyRevision, "fresh");
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

function createPolicyArtifact(
  policyRevision: string,
  posture: "fresh" | "last-known-good",
): AuthoredPolicyArtifactV0 {
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
      warmup_judged_activations: LAST_KNOWN_GOOD_ACTIVATIONS,
    },
    thresholds: {
      max_calibration_divergence_multiplier: 1.6,
      escalation_precision_floor: 0.82,
      backstop_deep_contradiction_count: 1,
      stale_brief_minutes: 45,
      fresh_tokens_per_day_ceiling: 1200,
    },
    transitive_freshness_function: { kind: "kernel-default" },
    falsification_predicate:
      posture === "last-known-good"
        ? {
            kind: "greater-than-or-equal",
            fact: "kernel.deep_shallow_contradiction_count_7d",
            value: 0,
          }
        : {
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
  const validation = b3PolicyApi.validatePolicyArtifactV0(policy);
  if (!validation.ok || validation.bytes === undefined || validation.content_hash === undefined) {
    throw new Error(
      `B3 fixture policy failed validation: ${(validation.errors ?? []).join("; ")}`,
    );
  }

  return {
    bytes: validation.bytes,
    content_hash: validation.content_hash,
  };
}

function readB3PolicyRecompileReport(
  result: ReactorB3TickResultV0,
): ReactorPolicyRecompileTickResultV0 {
  if (result.policy_recompile === undefined) {
    throw new Error("B3 fresh-install tick must report policy_recompile");
  }

  return result.policy_recompile;
}

function readB3PolicyRollbackReport(
  result: ReactorB3TickResultV0,
): Readonly<Record<string, unknown>> {
  const resultRecord = result as unknown as Readonly<Record<string, unknown>>;
  const report = resultRecord["policy_rollback"];

  return readRequiredRecord(report, "policy_rollback");
}

function findRollbackReceipt(
  receipts: readonly ReceiptV0[],
  report: Readonly<Record<string, unknown>>,
): ReceiptV0 {
  const reportHash =
    readOptionalString(report["rollback_receipt_hash"]) ??
    readOptionalString(report["receipt_hash"]);
  const candidates =
    reportHash === undefined
      ? receipts.filter(isRollbackReceipt)
      : receipts.filter((receipt) => receipt.content_hash === reportHash);

  equal(candidates.length, 1);
  const receipt = candidates[0];
  ok(receipt !== undefined);
  ok(isRollbackReceipt(receipt));

  return receipt;
}

function isRollbackReceipt(receipt: ReceiptV0): boolean {
  return (
    receipt.cost.tags.includes("policy-rollback") ||
    (isRecord(receipt.cost.provider_norm) &&
      receipt.cost.provider_norm["schema"] === ROLLBACK_PROVIDER_NORM_SCHEMA)
  );
}

function readPolicyTripSummary(
  value: unknown,
  key: "fresh_policy" | "last_known_good_policy",
): B3PolicyTripSummaryV0 {
  const source = readRequiredRecord(value, key === "fresh_policy" ? key : key);
  const nested = source[key];
  const prefix = key === "fresh_policy" ? "fresh_policy" : "last_known_good";
  const record = isRecord(nested) ? nested : source;
  const path = isRecord(nested) ? key : prefix;

  return {
    policy_revision: readRequiredStringFromAliases(
      record,
      [`${prefix}_revision`, "policy_revision", "revision"],
      `${path}.policy_revision`,
    ),
    judged_activations_before_trip: readRequiredNumberFromAliases(
      record,
      [
        `${prefix}_judged_activations_before_trip`,
        "judged_activations_before_trip",
      ],
      `${path}.judged_activations_before_trip`,
    ),
    activated_at: readRequiredStringFromAliases(
      record,
      [`${prefix}_activated_at`, "activated_at"],
      `${path}.activated_at`,
    ),
    first_trip_at: readRequiredStringFromAliases(
      record,
      [`${prefix}_first_trip_at`, "first_trip_at"],
      `${path}.first_trip_at`,
    ),
  };
}

function assertEventVolumeNormalizedRollback(
  freshPolicy: B3PolicyTripSummaryV0,
  lastKnownGoodPolicy: B3PolicyTripSummaryV0,
): void {
  equal(freshPolicy.policy_revision, FRESH_POLICY_REVISION);
  equal(lastKnownGoodPolicy.policy_revision, LAST_KNOWN_GOOD_REVISION);
  equal(
    freshPolicy.judged_activations_before_trip,
    FRESH_POLICY_ACTIVATIONS,
  );
  equal(
    lastKnownGoodPolicy.judged_activations_before_trip,
    LAST_KNOWN_GOOD_ACTIVATIONS,
  );
  ok(
    freshPolicy.judged_activations_before_trip <
      lastKnownGoodPolicy.judged_activations_before_trip,
  );
  ok(
    durationMs(freshPolicy.activated_at, freshPolicy.first_trip_at) >
      durationMs(lastKnownGoodPolicy.activated_at, lastKnownGoodPolicy.first_trip_at),
  );
}

function durationMs(start: string, end: string): number {
  return Date.parse(end) - Date.parse(start);
}

function readRequiredRecord(
  value: unknown,
  path: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value;
}

function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
}

function readRequiredNumber(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive safe integer`);
  }

  return value;
}

function readRequiredStringFromAliases(
  record: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  path: string,
): string {
  for (const key of keys) {
    const value = readOptionalString(record[key]);
    if (value !== undefined) {
      return value;
    }
  }

  throw new Error(`${path} must be a non-empty string`);
}

function readRequiredNumberFromAliases(
  record: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  path: string,
): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      return value;
    }
  }

  throw new Error(`${path} must be a positive safe integer`);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function memoSourceTag(policyRevision: string): string {
  return `runtime-memo-source:${POLICY_NAMESPACE}@${policyRevision}`;
}

const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: "cost.fresh_tokens_per_maintained_day",
    source: "cost-ledger",
    description: "Fresh tokens per maintained briefing day.",
  },
  {
    id: "kernel.deep_shallow_contradiction_count_7d",
    source: "kernel-backstop",
    description: "Deep/shallow contradiction count.",
  },
];
