import {
  computeMemoKeyV0,
  createMemoHitReceiptV0,
  type DependencyReceiptMemoRefV0,
} from "../memo";
import { createComposedReceiptFreshnessV0 } from "../composition";
import {
  evaluateForecastScheduleV0,
  type ForecastScheduleStateV0,
} from "../forecast";
import {
  type CompiledEvidencePlan,
  type CompiledEvidenceSource,
  validateCompiledEvidencePlan,
} from "../evidence-plan";
import {
  createKernelSafetyReceipt,
  detectReceiptCycles,
  type ConsumedReceiptEdge,
} from "../kernel";
import {
  authorPolicyArtifactV0,
  executePolicyRecompileV0,
  normalizePolicyTransitiveFreshnessFunctionV0,
  planPolicyRecompileV0,
  planPolicyRollbackV0,
  validatePolicyArtifactV0,
  type AuthoredPolicyArtifactV0,
  type PolicyLiveObservableV0,
  type PolicyRecompileExecutionV0,
  type PolicyTransitiveFreshnessFunctionV0,
} from "../policy";
import {
  type ConsumedReceiptPinV0,
  type ContentHashV0,
  type ReceiptFreshnessV0,
  type ReceiptEventCauseV0,
  type ReceiptRecheckKindV0,
  type ReceiptV0,
  canonicalizeForReceiptV0,
  createNullSignerReceiptSignatureV0,
  createReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} from "../receipt";
import { runShallowJudgeV0 } from "../judge";
import type {
  ReactorAdaptersV0,
  ReactorCreateInputV0,
  ReactorConnectorResponseV0,
  ReactorIngestResultV0,
  ReactorPolicyRollbackMetadataV0,
  ReactorPolicyRollbackTickResultV0,
  ReactorPolicyRecompileTickResultV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkEventV0,
  ReactorTickResultV0,
} from "../sdk";

export interface ReactorRuntimeV0 {
  readonly ingest: (event: unknown) => ReactorIngestResultV0;
  readonly tick: (as_of?: string) => ReactorTickResultV0;
  readonly receipts: () => readonly ReceiptV0[];
  readonly registry: () => ReactorRegistrySnapshotV0;
}

interface ReactorTurnBaseV0 {
  readonly contract_revision?: ContentHashV0;
  readonly cold_start?: ColdStartPolicyInputV0;
  readonly evidence?: readonly ReactorEvidenceInputV0[];
  readonly dependency_receipts?: readonly ReceiptV0[];
}

export interface ContractSummaryProjectionV0 {
  readonly summary: string;
  readonly source_contract_revision: ContentHashV0;
  readonly projection_hash: ContentHashV0;
}

export interface ColdStartPolicyInputV0 {
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: ContractSummaryProjectionV0;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly compiled_evidence_plan: CompiledEvidencePlan;
  readonly forecast_schedule: ForecastScheduleStateV0;
  readonly policy_artifact_namespace?: string;
}

export interface ReactorEvidenceInputV0 {
  readonly source_id: string;
  readonly receipt?: ReceiptV0;
  readonly content_hash?: ContentHashV0;
  readonly payload?: unknown;
}

export interface ReactorRealInputTurnV0 extends ReactorTurnBaseV0 {
  readonly kind: "real-input";
}

export interface ReactorForecastRecheckTurnV0 extends ReactorTurnBaseV0 {
  readonly kind: "forecast-recheck";
  readonly recheck_kind: ReceiptRecheckKindV0;
}

export interface ReactorEscalationTurnV0 extends ReactorTurnBaseV0 {
  readonly kind: "escalation";
  readonly interrupt_cause: "needs-judgment" | "needs-input" | "contract-declared";
  readonly reason: string;
  readonly fix_target: string;
}

export type ReactorTurnInputV0 =
  | ReactorRealInputTurnV0
  | ReactorForecastRecheckTurnV0
  | ReactorEscalationTurnV0;

interface RuntimeRegistryV0 {
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly policy_artifact_content_hash?: ContentHashV0;
  readonly transitive_freshness_function: PolicyTransitiveFreshnessFunctionV0;
  readonly compiled_evidence_plan: CompiledEvidencePlan;
  readonly forecast_schedule: ForecastScheduleStateV0;
  readonly forecast: RuntimeForecastStateV0;
}

interface RuntimeForecastStateV0 {
  readonly next_due_at?: string;
  readonly due_rechecks: readonly ReceiptRecheckKindV0[];
  readonly receipt_next_forecast_recheck: string;
}

interface RuntimePolicyLoopMetadataV0 {
  readonly contract_summary: string;
  readonly last_policy_revalidated_at: string;
  readonly last_recompile_at: string;
  readonly last_unforced_deep_at?: string;
}

interface NormalizedEvidenceInputV0 {
  readonly source_id: string;
  readonly content_hash: ContentHashV0;
}

type PlannedEvidenceSelectionV0 =
  | {
      readonly ok: true;
      readonly evidence: readonly NormalizedEvidenceInputV0[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly fix_target: string;
      readonly interrupt_cause: "needs-judgment" | "needs-input";
    };

interface VerifiedDependencyReceiptV0 {
  readonly receipt: ReceiptV0;
  readonly content_hash: ContentHashV0;
  readonly memo_ref: DependencyReceiptMemoRefV0;
  readonly pin: ConsumedReceiptPinV0;
}

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RUNTIME_MEMO_SOURCE_TAG_PREFIX = "runtime-memo-source:";
const UNINITIALIZED_POLICY_NAMESPACE = "policy.uninitialized";
const UNINITIALIZED_POLICY_REVISION = "0";
const POLICY_LIVE_OBSERVABLE_SOURCES = new Set([
  "connector",
  "receipt-log",
  "kernel-backstop",
  "cost-ledger",
  "human-label-stream",
]);
const POLICY_ROLLBACK_METADATA_SCHEMA =
  "openprose.reactor.policy-rollback.metadata" as const;
const POLICY_ROLLBACK_RECEIPT_SCHEMA =
  "openprose.reactor.policy-rollback.receipt" as const;

interface PolicyLoopAfterTickV0 {
  readonly policy_recompile: ReactorPolicyRecompileTickResultV0;
  readonly policy_rollback?: ReactorPolicyRollbackTickResultV0;
}

class PolicyRollbackFailure extends Error {
  override readonly name = "PolicyRollbackFailure";
}

export function createRuntimeReactorV0(
  input: ReactorCreateInputV0,
): ReactorRuntimeV0 {
  return {
    ingest(event: unknown): ReactorIngestResultV0 {
      const asOf = input.adapters.clock.now();
      return ingestEvent({
        responsibility_id: input.responsibility_id,
        adapters: input.adapters,
        as_of: asOf,
        event,
      });
    },
    tick(as_of?: string): ReactorTickResultV0 {
      const asOf = as_of ?? input.adapters.clock.now();
      return tickRuntimeScheduler({
        responsibility_id: input.responsibility_id,
        adapters: input.adapters,
        as_of: asOf,
      });
    },
    receipts(): readonly ReceiptV0[] {
      return input.adapters.storage.listReceipts();
    },
    registry(): ReactorRegistrySnapshotV0 {
      return input.adapters.storage.readRegistry();
    },
  };
}

function ingestEvent(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly event: unknown;
}): ReactorIngestResultV0 {
  emitIngest(input.responsibility_id, input.adapters, input.as_of, input.event);

  try {
    const turn = normalizeTurnInputV0(input.event);
    if (turn === undefined) {
      return ingestUnsupportedInput({
        responsibility_id: input.responsibility_id,
        adapters: input.adapters,
        as_of: input.as_of,
        event: input.event,
      });
    }

    return ingestTypedTurn({
      responsibility_id: input.responsibility_id,
      adapters: input.adapters,
      as_of: input.as_of,
      turn,
    });
  } catch (error) {
    return {
      accepted: false,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "failed-before-write",
      errors: [
        error instanceof Error ? error.message : "reactor ingest failed",
      ],
    };
  }
}

function tickRuntimeScheduler(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
}): ReactorTickResultV0 {
  if (!isReplayableInstant(input.as_of)) {
    return {
      accepted: false,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "failed-before-write",
      receipts_appended: 0,
      receipt_hashes: [],
      errors: ["tick as_of must be a replayable instant"],
    };
  }

  const beforeReceiptCount = input.adapters.storage.listReceipts().length;
  let registry: RuntimeRegistryV0;
  try {
    registry = readRuntimeRegistry(
      input.adapters.storage.readRegistry(),
      input.responsibility_id,
      undefined,
      input.as_of,
      false,
    );
  } catch (error) {
    return {
      accepted: false,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "failed-before-write",
      receipts_appended: input.adapters.storage.listReceipts().length -
        beforeReceiptCount,
      receipt_hashes: [],
      errors: [
        error instanceof Error
          ? error.message
          : "reactor scheduler tick failed",
      ],
    };
  }

  if (registry.forecast.due_rechecks.length === 0) {
    return {
      accepted: true,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "no-work",
      receipts_appended: 0,
      receipt_hashes: [],
      ...(registry.forecast.next_due_at === undefined
        ? {}
        : { next_due_at: registry.forecast.next_due_at }),
      due_rechecks: [],
    };
  }

  const dueRechecks = pendingDueRechecks({
    registry,
    receipts: input.adapters.storage.listReceipts(),
  });
  if (dueRechecks.length === 0) {
    return {
      accepted: true,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "no-work",
      receipts_appended: 0,
      receipt_hashes: [],
      ...(registry.forecast.next_due_at === undefined
        ? {}
        : { next_due_at: registry.forecast.next_due_at }),
      due_rechecks: [],
    };
  }

  const results: ReactorIngestResultV0[] = [];
  try {
    for (const recheckKind of dueRechecks) {
      const evidence = readPlannedAdapterEvidence({
        plan: registry.compiled_evidence_plan,
        adapters: input.adapters,
        as_of: input.as_of,
      });
      const result = ingestEvent({
        responsibility_id: input.responsibility_id,
        adapters: input.adapters,
        as_of: input.as_of,
        event: {
          kind: "forecast-recheck",
          recheck_kind: recheckKind,
          evidence,
        },
      });
      results.push(result);
      if (!result.accepted) {
        break;
      }
    }
  } catch (error) {
    return {
      accepted: false,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "failed-before-write",
      receipts_appended: input.adapters.storage.listReceipts().length -
        beforeReceiptCount,
      receipt_hashes: results.flatMap((result) =>
        result.receipt_hash === undefined ? [] : [result.receipt_hash],
      ),
      ...(registry.forecast.next_due_at === undefined
        ? {}
        : { next_due_at: registry.forecast.next_due_at }),
      due_rechecks: dueRechecks,
      recheck_results: results,
      errors: [
        error instanceof Error
          ? error.message
          : "reactor scheduler tick failed",
      ],
    };
  }

  const afterRecheckReceiptCount = input.adapters.storage.listReceipts().length;
  const receiptHashes = results.flatMap((result) =>
    result.receipt_hash === undefined ? [] : [result.receipt_hash],
  );
  const errors = results.flatMap((result) => result.errors ?? []);
  const last = results.at(-1);
  const accepted = results.every((result) => result.accepted);
  let policyLoop: PolicyLoopAfterTickV0 | undefined;

  if (accepted && afterRecheckReceiptCount > beforeReceiptCount) {
    try {
      policyLoop = planAndMaybeExecutePolicyRecompileAfterTick({
        responsibility_id: input.responsibility_id,
        adapters: input.adapters,
        as_of: input.as_of,
      });
    } catch (error) {
      return {
        accepted: false,
        responsibility_id: input.responsibility_id,
        as_of: input.as_of,
        outcome:
          error instanceof PolicyRollbackFailure
            ? "policy-rollback-failed"
            : "policy-recompile-failed",
        receipts_appended: input.adapters.storage.listReceipts().length -
          beforeReceiptCount,
        receipt_hashes: receiptHashes,
        ...(last?.next_due_at === undefined
          ? registry.forecast.next_due_at === undefined
            ? {}
            : { next_due_at: registry.forecast.next_due_at }
          : { next_due_at: last.next_due_at }),
        due_rechecks: dueRechecks,
        recheck_results: results,
        ...(policyLoop?.policy_recompile === undefined
          ? {}
          : { policy_recompile: policyLoop.policy_recompile }),
        ...(policyLoop?.policy_rollback === undefined
          ? {}
          : { policy_rollback: policyLoop.policy_rollback }),
        errors: [
          ...errors,
          error instanceof Error
            ? error.message
            : "reactor policy loop planning failed",
        ],
      };
    }
  }

  const finalReceiptCount = input.adapters.storage.listReceipts().length;
  const policyReceiptHashes =
    policyLoop?.policy_rollback?.receipt_hash === undefined
      ? []
      : [policyLoop.policy_rollback.receipt_hash];

  return {
    accepted,
    responsibility_id: input.responsibility_id,
    as_of: input.as_of,
    outcome: accepted ? "rechecks-completed" : "failed-before-write",
    receipts_appended: finalReceiptCount - beforeReceiptCount,
    receipt_hashes: [...receiptHashes, ...policyReceiptHashes],
    ...(last?.next_due_at === undefined
      ? registry.forecast.next_due_at === undefined
        ? {}
        : { next_due_at: registry.forecast.next_due_at }
      : { next_due_at: last.next_due_at }),
    due_rechecks: dueRechecks,
    recheck_results: results,
    ...(policyLoop?.policy_recompile === undefined
      ? {}
      : { policy_recompile: policyLoop.policy_recompile }),
    ...(policyLoop?.policy_rollback === undefined
      ? {}
      : { policy_rollback: policyLoop.policy_rollback }),
    ...(errors.length === 0 ? {} : { errors }),
  };
}

function planAndMaybeExecutePolicyRecompileAfterTick(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
}): PolicyLoopAfterTickV0 {
  const registry = input.adapters.storage.readRegistry();
  const activePolicy = readActivePolicyArtifactFromRegistry({
    responsibility_id: input.responsibility_id,
    registry,
  });
  const loopMetadata = readPolicyLoopMetadata(
    registry,
    activePolicy.artifact.provenance.contract_revision,
  );
  const receipts = input.adapters.storage.listReceipts();
  const decision = planPolicyRecompileV0({
    artifact: activePolicy.artifact,
    receipts,
    as_of: input.as_of,
    last_policy_revalidated_at: loopMetadata.last_policy_revalidated_at,
    last_recompile_at: loopMetadata.last_recompile_at,
    ...(loopMetadata.last_unforced_deep_at === undefined
      ? {}
      : { last_unforced_deep_at: loopMetadata.last_unforced_deep_at }),
  });
  const rollback =
    decision.drift.outcome === "tripped"
      ? planAndMaybeExecutePolicyRollbackAfterSelfTrip({
          responsibility_id: input.responsibility_id,
          adapters: input.adapters,
          as_of: input.as_of,
          registry,
          active_policy: activePolicy.artifact,
          self_trip: decision,
        })
      : undefined;

  if (decision.outcome !== "recompile-requested") {
    return {
      policy_recompile: {
        policy_artifact_revision_before: activePolicy.artifact.policy_revision,
        decision,
      },
      ...(rollback === undefined ? {} : { policy_rollback: rollback }),
    };
  }

  if (rollback?.decision.outcome === "rollback") {
    return {
      policy_recompile: {
        policy_artifact_revision_before: activePolicy.artifact.policy_revision,
        decision,
      },
      policy_rollback: rollback,
    };
  }

  const execution = executePolicyRecompileV0({
    decision,
    author_input: {
      responsibility_id: input.responsibility_id,
      contract_revision: activePolicy.artifact.provenance.contract_revision,
      contract_summary: loopMetadata.contract_summary,
      no_anchor: activePolicy.artifact.no_anchor,
      live_observables: activePolicy.artifact.live_observables,
      receipt_history: receipts,
      agentSdk: input.adapters.agentSdk,
      policy_artifact_namespace: registry.policy_artifact_namespace,
    },
  });

  if (execution.outcome === "recompile-authored") {
    persistPolicyRecompileExecution({
      responsibility_id: input.responsibility_id,
      adapters: input.adapters,
      as_of: input.as_of,
      current_registry: registry,
      execution,
    });
  }

  return {
    policy_recompile: {
      policy_artifact_revision_before: activePolicy.artifact.policy_revision,
      ...(execution.outcome === "recompile-authored"
        ? {
            policy_artifact_revision_after:
              execution.registry.policy_artifact_revision,
            compiled_evidence_plan_strategy: "carried-forward" as const,
          }
        : {}),
      decision,
      execution,
    },
    ...(rollback === undefined ? {} : { policy_rollback: rollback }),
  };
}

function planAndMaybeExecutePolicyRollbackAfterSelfTrip(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly registry: ReactorRegistrySnapshotV0;
  readonly active_policy: AuthoredPolicyArtifactV0;
  readonly self_trip: ReactorPolicyRecompileTickResultV0["decision"];
}): ReactorPolicyRollbackTickResultV0 | undefined {
  const metadata = readPolicyRollbackMetadata(input.registry);
  if (metadata === undefined) {
    return undefined;
  }
  if (metadata.fresh_policy_revision !== input.active_policy.policy_revision) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback fresh_policy_revision conflicts with active policy",
    );
  }

  const receipts = input.adapters.storage.listReceipts();
  const freshActivations = countJudgedActivationsForPolicy({
    receipts,
    responsibility_id: input.responsibility_id,
    contract_revision: input.active_policy.provenance.contract_revision,
    policy_artifact_namespace: input.registry.policy_artifact_namespace,
    policy_artifact_revision: input.active_policy.policy_revision,
    since: metadata.fresh_policy_installed_at,
    through: input.as_of,
  });
  const targetRegistry = validateRollbackTargetRegistry({
    responsibility_id: input.responsibility_id,
    as_of: input.as_of,
    active_contract_revision: input.active_policy.provenance.contract_revision,
    metadata,
  });
  const decision = planPolicyRollbackV0({
    fresh_policy_revision: input.active_policy.policy_revision,
    fresh_policy_judged_activations_before_trip: freshActivations,
    last_known_good_revision:
      metadata.last_known_good.policy_artifact_revision,
    last_known_good_judged_activations_before_trip:
      metadata.last_known_good.judged_activations_before_trip,
  });
  const reportBase = {
    policy_artifact_revision_before: input.active_policy.policy_revision,
    fresh_policy_installed_at: metadata.fresh_policy_installed_at,
    fresh_policy_judged_activations_before_trip: freshActivations,
    last_known_good_judged_activations_before_trip:
      metadata.last_known_good.judged_activations_before_trip,
    decision,
    self_trip: input.self_trip,
  } as const;

  if (decision.outcome !== "rollback") {
    return reportBase;
  }

  const receipt = createPolicyRollbackReceipt({
    responsibility_id: input.responsibility_id,
    contract_revision: input.active_policy.provenance.contract_revision,
    as_of: input.as_of,
    target_registry: targetRegistry,
    decision,
    self_trip: input.self_trip,
  });
  const verification = verifyReceiptV0(receipt);
  if (!verification.ok) {
    throw new PolicyRollbackFailure(
      `policy rollback receipt failed verification: ${verification.errors.join("; ")}`,
    );
  }

  persistPolicyRollbackTargetRegistry({
    responsibility_id: input.responsibility_id,
    adapters: input.adapters,
    as_of: input.as_of,
    target_registry: targetRegistry,
  });
  input.adapters.storage.appendReceipt(receipt);

  return {
    ...reportBase,
    policy_artifact_revision_after: targetRegistry.policy_artifact_revision,
    receipt_hash: verification.content_hash,
  };
}

function readPolicyRollbackMetadata(
  registry: ReactorRegistrySnapshotV0,
): ReactorPolicyRollbackMetadataV0 | undefined {
  const value = registry.policy_rollback;
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new PolicyRollbackFailure("registry.policy_rollback must be an object");
  }
  if (value["schema"] !== POLICY_ROLLBACK_METADATA_SCHEMA) {
    throw new PolicyRollbackFailure("registry.policy_rollback.schema is malformed");
  }
  if (value["v"] !== 0) {
    throw new PolicyRollbackFailure("registry.policy_rollback.v must be 0");
  }

  const freshPolicyRevision = readNonEmptyString(value["fresh_policy_revision"]);
  if (freshPolicyRevision === undefined) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback.fresh_policy_revision must be non-empty",
    );
  }
  const freshPolicyInstalledAt = readNonEmptyString(
    value["fresh_policy_installed_at"],
  );
  if (
    freshPolicyInstalledAt === undefined ||
    !isReplayableInstant(freshPolicyInstalledAt)
  ) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback.fresh_policy_installed_at must be replayable",
    );
  }

  const lastKnownGood = value["last_known_good"];
  if (!isRecord(lastKnownGood)) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback.last_known_good must be an object",
    );
  }
  const lastKnownGoodRevision = readNonEmptyString(
    lastKnownGood["policy_artifact_revision"],
  );
  if (lastKnownGoodRevision === undefined) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback.last_known_good.policy_artifact_revision must be non-empty",
    );
  }
  const lastKnownGoodActivations =
    lastKnownGood["judged_activations_before_trip"];
  if (!isNonNegativeSafeInteger(lastKnownGoodActivations)) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback.last_known_good.judged_activations_before_trip must be a non-negative safe integer",
    );
  }
  const lastKnownGoodRegistry = lastKnownGood["registry"];
  if (!isRecord(lastKnownGoodRegistry)) {
    throw new PolicyRollbackFailure(
      "registry.policy_rollback.last_known_good.registry must be an object",
    );
  }

  return {
    schema: POLICY_ROLLBACK_METADATA_SCHEMA,
    v: 0,
    fresh_policy_revision: freshPolicyRevision,
    fresh_policy_installed_at: freshPolicyInstalledAt,
    last_known_good: {
      policy_artifact_revision: lastKnownGoodRevision,
      judged_activations_before_trip: lastKnownGoodActivations,
      registry: lastKnownGoodRegistry as ReactorRegistrySnapshotV0,
    },
  };
}

function validateRollbackTargetRegistry(input: {
  readonly responsibility_id: string;
  readonly as_of: string;
  readonly active_contract_revision: ContentHashV0;
  readonly metadata: ReactorPolicyRollbackMetadataV0;
}): ReactorRegistrySnapshotV0 {
  const targetRegistry = cloneRegistryWithoutRollbackMetadata(
    input.metadata.last_known_good.registry,
  );

  try {
    const runtimeRegistry = readRuntimeRegistry(
      targetRegistry,
      input.responsibility_id,
      undefined,
      input.as_of,
      false,
    );
    if (runtimeRegistry.contract_revision !== input.active_contract_revision) {
      throw new Error("rollback target contract_revision conflicts with active policy");
    }
    if (
      runtimeRegistry.policy_artifact_revision !==
      input.metadata.last_known_good.policy_artifact_revision
    ) {
      throw new Error("rollback target revision conflicts with rollback metadata");
    }
    readActivePolicyArtifactFromRegistry({
      responsibility_id: input.responsibility_id,
      registry: targetRegistry,
    });
  } catch (error) {
    throw new PolicyRollbackFailure(
      `registry.policy_rollback.last_known_good.registry cannot be validated: ${
        error instanceof Error ? error.message : "unknown validation failure"
      }`,
    );
  }

  return targetRegistry;
}

function persistPolicyRollbackTargetRegistry(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly target_registry: ReactorRegistrySnapshotV0;
}): void {
  const writeRegistry = input.adapters.storage.writeRegistry;
  if (typeof writeRegistry !== "function") {
    throw new PolicyRollbackFailure(
      "storage.writeRegistry is required for policy rollback persistence",
    );
  }

  try {
    writeRegistry(input.target_registry);
    const persisted = input.adapters.storage.readRegistry();
    validateRollbackTargetRegistry({
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      active_contract_revision: input.target_registry.contract_revision as ContentHashV0,
      metadata: {
        schema: POLICY_ROLLBACK_METADATA_SCHEMA,
        v: 0,
        fresh_policy_revision: input.target_registry.policy_artifact_revision,
        fresh_policy_installed_at: input.as_of,
        last_known_good: {
          policy_artifact_revision: input.target_registry.policy_artifact_revision,
          judged_activations_before_trip: 0,
          registry: persisted,
        },
      },
    });
  } catch (error) {
    throw new PolicyRollbackFailure(
      `policy rollback persistence failed: ${
        error instanceof Error ? error.message : "unknown persistence failure"
      }`,
    );
  }
}

function createPolicyRollbackReceipt(input: {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly target_registry: ReactorRegistrySnapshotV0;
  readonly decision: ReactorPolicyRollbackTickResultV0["decision"];
  readonly self_trip: ReactorPolicyRecompileTickResultV0["decision"];
}): ReceiptV0 {
  const lastKnownGoodActivations =
    input.decision.last_known_good_judged_activations_before_trip;
  if (lastKnownGoodActivations === undefined) {
    throw new PolicyRollbackFailure(
      "policy rollback decision must include last-known-good judged activations",
    );
  }
  if (input.decision.target_policy_revision === undefined) {
    throw new PolicyRollbackFailure(
      "policy rollback decision must include target_policy_revision",
    );
  }

  const evidenceInputId = policyRollbackEvidenceInputId(input);
  return createReceiptV0({
    core: {
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      event_cause: "escalation",
      memo_key: `policy-rollback:${evidenceInputId}`,
      evidence_input_ids: [evidenceInputId],
      as_of: input.as_of,
      role: "policy-compile",
    },
    sig: createNullSignerReceiptSignatureV0(),
    verdict: {
      status: "up",
      confidence: {
        value: 1,
        derivation_method: "deterministic-policy-rollback",
        calibration_grade: "none",
        label_source: "runtime-policy-rollback",
      },
    },
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck:
        optionalNextForecastRecheck(input.target_registry) ?? input.as_of,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "runtime",
      model: "deterministic-policy-rollback",
      role: "policy-compile",
      tags: [
        "policy-rollback",
        `policy-rollback:fresh:${input.decision.fresh_policy_revision}`,
        `policy-rollback:target:${input.decision.target_policy_revision}`,
        `policy-rollback:fresh-judged-activations:${input.decision.fresh_policy_judged_activations_before_trip}`,
        `policy-rollback:last-known-good-judged-activations:${lastKnownGoodActivations}`,
      ],
      responsibility_id: input.responsibility_id,
      run_id: `policy-rollback-${input.as_of}`,
      as_of: input.as_of,
      tokens: { fresh: 0, reused: 0 },
      surprise_cause: "escalation",
      provider_norm: {
        schema: POLICY_ROLLBACK_RECEIPT_SCHEMA,
        fresh_policy_revision: input.decision.fresh_policy_revision,
        target_policy_revision: input.decision.target_policy_revision,
        fresh_policy_judged_activations_before_trip:
          input.decision.fresh_policy_judged_activations_before_trip,
        last_known_good_judged_activations_before_trip:
          lastKnownGoodActivations,
        self_trip_outcome: input.self_trip.outcome,
      },
    },
  });
}

function policyRollbackEvidenceInputId(input: {
  readonly decision: ReactorPolicyRollbackTickResultV0["decision"];
  readonly self_trip: ReactorPolicyRecompileTickResultV0["decision"];
}): ContentHashV0 {
  return hashCanonicalReceiptV0(
    canonicalizeForReceiptV0({
      schema: "openprose.reactor.policy-rollback.evidence",
      v: 0,
      decision: input.decision,
      self_trip: {
        outcome: input.self_trip.outcome,
        policy_artifact_revision: input.self_trip.policy_artifact_revision,
        policy_artifact_content_hash:
          input.self_trip.policy_artifact_content_hash,
        requested_by: input.self_trip.requested_by,
        drift_outcome: input.self_trip.drift.outcome,
        evidence_receipt_hashes: input.self_trip.evidence_receipt_hashes,
      },
    }),
  );
}

function readActivePolicyArtifactFromRegistry(input: {
  readonly responsibility_id: string;
  readonly registry: ReactorRegistrySnapshotV0;
}): {
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly content_hash: ContentHashV0;
} {
  const bytes = input.registry.policy_artifact_bytes;
  if (typeof bytes !== "string" || bytes.length === 0) {
    throw new Error("registry.policy_artifact_bytes is required for policy recompile planning");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes) as unknown;
  } catch {
    throw new Error("registry.policy_artifact_bytes must contain a JSON policy artifact");
  }

  const validation = validatePolicyArtifactV0(parsed);
  if (!validation.ok) {
    throw new Error(
      `registry.policy_artifact_bytes failed policy validation: ${validation.errors.join("; ")}`,
    );
  }
  if (validation.bytes !== bytes) {
    throw new Error("registry.policy_artifact_bytes must be canonical policy artifact bytes");
  }
  if (validation.artifact.responsibility_id !== input.responsibility_id) {
    throw new Error("registry.policy_artifact_bytes responsibility_id conflicts with runtime responsibility_id");
  }
  if (
    isContentHash(input.registry.contract_revision) &&
    validation.artifact.provenance.contract_revision !== input.registry.contract_revision
  ) {
    throw new Error("registry.policy_artifact_bytes contract_revision conflicts with registry.contract_revision");
  }
  if (
    input.registry.policy_artifact_revision !==
    validation.artifact.policy_revision
  ) {
    throw new Error("registry.policy_artifact_bytes policy_revision conflicts with registry.policy_artifact_revision");
  }
  if (
    input.registry.policy_artifact_id !== undefined &&
    input.registry.policy_artifact_id !== validation.artifact.registry_id
  ) {
    throw new Error("registry.policy_artifact_id conflicts with policy artifact registry_id");
  }
  if (
    input.registry.policy_artifact_identity !== undefined &&
    input.registry.policy_artifact_identity !== validation.artifact.registry_id
  ) {
    throw new Error("registry.policy_artifact_identity conflicts with policy artifact registry_id");
  }
  if (
    input.registry.policy_artifact_content_hash !== undefined &&
    input.registry.policy_artifact_content_hash !== validation.content_hash
  ) {
    throw new Error("registry.policy_artifact_content_hash conflicts with policy_artifact_bytes");
  }

  return {
    artifact: validation.artifact,
    content_hash: validation.content_hash,
  };
}

function readPolicyLoopMetadata(
  registry: ReactorRegistrySnapshotV0,
  contractRevision: ContentHashV0,
): RuntimePolicyLoopMetadataV0 {
  return {
    contract_summary: readRegistryContractSummary(registry, contractRevision),
    last_policy_revalidated_at: readRegistryReplayableInstant(
      registry,
      "last_policy_revalidated_at",
    ),
    last_recompile_at: readRegistryReplayableInstant(
      registry,
      "last_recompile_at",
    ),
    ...(registry.last_unforced_deep_at === undefined
      ? {}
      : {
          last_unforced_deep_at: readRegistryReplayableInstant(
            registry,
            "last_unforced_deep_at",
          ),
        }),
  };
}

function readRegistryContractSummary(
  registry: ReactorRegistrySnapshotV0,
  contractRevision: ContentHashV0,
): string {
  const value = registry.contract_summary;
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (!isRecord(value)) {
    throw new Error("registry.contract_summary is required for policy recompile planning");
  }

  const summary = readNonEmptyString(value["summary"]);
  if (summary === undefined) {
    throw new Error("registry.contract_summary.summary must be non-empty for policy recompile planning");
  }
  if (value["source_contract_revision"] !== contractRevision) {
    throw new Error("registry.contract_summary source_contract_revision conflicts with policy artifact");
  }
  if (!isContentHash(value["projection_hash"])) {
    throw new Error("registry.contract_summary.projection_hash must be a sha256 content address");
  }

  return summary;
}

function readRegistryReplayableInstant(
  registry: ReactorRegistrySnapshotV0,
  field: "last_policy_revalidated_at" | "last_recompile_at" | "last_unforced_deep_at",
): string {
  const value = registry[field];
  if (typeof value !== "string" || !isReplayableInstant(value)) {
    throw new Error(`registry.${field} must be a replayable instant for policy recompile planning`);
  }

  return value;
}

function persistPolicyRecompileExecution(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly current_registry: ReactorRegistrySnapshotV0;
  readonly execution: Extract<
    PolicyRecompileExecutionV0,
    { readonly outcome: "recompile-authored" }
  >;
}): void {
  const writeRegistry = input.adapters.storage.writeRegistry;
  if (typeof writeRegistry !== "function") {
    throw new Error("storage.writeRegistry is required for policy recompile persistence");
  }
  if (
    input.execution.registry.contract_revision !==
    input.current_registry.contract_revision
  ) {
    throw new Error("authored policy contract_revision conflicts with active registry");
  }

  const currentPlan = readCompiledEvidencePlan(
    input.current_registry.compiled_evidence_plan,
    "registry.compiled_evidence_plan",
  );
  const currentSchedule = readForecastSchedule(
    input.current_registry.forecast_schedule,
  );
  const currentPolicySnapshot = createRollbackPolicySnapshot({
    responsibility_id: input.responsibility_id,
    registry: input.current_registry,
    as_of: input.as_of,
  });
  const currentPolicyActivations = countJudgedActivationsForPolicy({
    receipts: input.adapters.storage.listReceipts(),
    responsibility_id: input.responsibility_id,
    contract_revision: input.current_registry.contract_revision as ContentHashV0,
    policy_artifact_namespace: input.current_registry.policy_artifact_namespace,
    policy_artifact_revision: input.current_registry.policy_artifact_revision,
    through: input.as_of,
  });
  const nextPlan = carryForwardCompiledEvidencePlanForPolicyRecompile({
    plan: currentPlan,
    registry: input.execution.registry,
    as_of: input.as_of,
  });
  const nextRegistry: ReactorRegistrySnapshotV0 = {
    ...input.current_registry,
    ...input.execution.registry,
    compiled_evidence_plan: nextPlan,
    forecast_schedule: currentSchedule,
    ...(input.current_registry.contract_summary === undefined
      ? {}
      : { contract_summary: input.current_registry.contract_summary }),
    last_policy_revalidated_at: input.as_of,
    last_recompile_at: input.as_of,
    last_policy_recompile_at: input.as_of,
    ...(input.current_registry.last_unforced_deep_at === undefined
      ? {}
      : { last_unforced_deep_at: input.current_registry.last_unforced_deep_at }),
    policy_rollback: {
      schema: POLICY_ROLLBACK_METADATA_SCHEMA,
      v: 0,
      fresh_policy_revision: input.execution.registry.policy_artifact_revision,
      fresh_policy_installed_at: input.as_of,
      last_known_good: {
        policy_artifact_revision: input.current_registry.policy_artifact_revision,
        judged_activations_before_trip: currentPolicyActivations,
        registry: currentPolicySnapshot,
      },
    },
  };

  readRuntimeRegistry(
    nextRegistry,
    input.responsibility_id,
    undefined,
    input.as_of,
    false,
  );
  readActivePolicyArtifactFromRegistry({
    responsibility_id: input.responsibility_id,
    registry: nextRegistry,
  });

  writeRegistry(nextRegistry);

  const persistedRegistry = input.adapters.storage.readRegistry();
  readRuntimeRegistry(
    persistedRegistry,
    input.responsibility_id,
    undefined,
    input.as_of,
    false,
  );
  readActivePolicyArtifactFromRegistry({
    responsibility_id: input.responsibility_id,
    registry: persistedRegistry,
  });
}

function createRollbackPolicySnapshot(input: {
  readonly responsibility_id: string;
  readonly registry: ReactorRegistrySnapshotV0;
  readonly as_of: string;
}): ReactorRegistrySnapshotV0 {
  const snapshot = cloneRegistryWithoutRollbackMetadata(input.registry);

  readRuntimeRegistry(
    snapshot,
    input.responsibility_id,
    undefined,
    input.as_of,
    false,
  );
  readActivePolicyArtifactFromRegistry({
    responsibility_id: input.responsibility_id,
    registry: snapshot,
  });

  return snapshot;
}

function cloneRegistryWithoutRollbackMetadata(
  registry: ReactorRegistrySnapshotV0,
): ReactorRegistrySnapshotV0 {
  const snapshot = JSON.parse(canonicalizeForReceiptV0(registry)) as Record<
    string,
    unknown
  >;
  delete snapshot["policy_rollback"];

  return snapshot as ReactorRegistrySnapshotV0;
}

function countJudgedActivationsForPolicy(input: {
  readonly receipts: readonly ReceiptV0[];
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly since?: string;
  readonly through: string;
}): number {
  const throughMs = parseRuntimeInstantMs(input.through, "rollback through");
  const sinceMs =
    input.since === undefined
      ? Number.NEGATIVE_INFINITY
      : parseRuntimeInstantMs(input.since, "rollback since");
  const tag = `${RUNTIME_MEMO_SOURCE_TAG_PREFIX}${input.policy_artifact_namespace}@${input.policy_artifact_revision}`;

  return input.receipts.filter((receipt) => {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      return false;
    }

    const asOfMs = Date.parse(receipt.core.as_of);
    return (
      receipt.core.responsibility_id === input.responsibility_id &&
      receipt.core.contract_revision === input.contract_revision &&
      receipt.core.role === "judge" &&
      receipt.cost.tags.includes(tag) &&
      asOfMs >= sinceMs &&
      asOfMs <= throughMs
    );
  }).length;
}

function parseRuntimeInstantMs(value: string, name: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new PolicyRollbackFailure(`${name} must be a replayable instant`);
  }

  return ms;
}

function carryForwardCompiledEvidencePlanForPolicyRecompile(input: {
  readonly plan: CompiledEvidencePlan;
  readonly registry: ReactorRegistrySnapshotV0;
  readonly as_of: string;
}): CompiledEvidencePlan {
  return {
    ...input.plan,
    policy_artifact_namespace: input.registry.policy_artifact_namespace,
    policy_artifact_revision: input.registry.policy_artifact_revision,
    plan_revision: `${input.plan.plan_revision}+policy-recompile-carry-forward:${input.registry.policy_artifact_revision}`,
    as_of: input.as_of,
  };
}

function pendingDueRechecks(input: {
  readonly registry: RuntimeRegistryV0;
  readonly receipts: readonly ReceiptV0[];
}): readonly ReceiptRecheckKindV0[] {
  return input.registry.forecast.due_rechecks.filter((recheckKind) => {
    const scheduledAt =
      recheckKind === "evidence-age"
        ? input.registry.forecast_schedule.next_evidence_recheck
        : input.registry.forecast_schedule.next_plan_recheck;

    return !input.receipts.some((receipt) =>
      satisfiesScheduledRecheck(receipt, input.registry, recheckKind, scheduledAt),
    );
  });
}

function satisfiesScheduledRecheck(
  receipt: ReceiptV0,
  registry: RuntimeRegistryV0,
  recheckKind: ReceiptRecheckKindV0,
  scheduledAt: string,
): boolean {
  if (!verifyReceiptV0(receipt).ok) {
    return false;
  }

  return (
    receipt.core.responsibility_id === registry.forecast_schedule.responsibility_id &&
    receipt.core.contract_revision === registry.contract_revision &&
    receipt.core.event_cause === "forecast-recheck" &&
    receipt.core.recheck_kind === recheckKind &&
    Date.parse(receipt.core.as_of) >= Date.parse(scheduledAt)
  );
}

function ingestTypedTurn(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly turn: ReactorTurnInputV0;
}): ReactorIngestResultV0 {
  if (input.turn.kind === "escalation") {
    return ingestEscalationTurn({
      responsibility_id: input.responsibility_id,
      adapters: input.adapters,
      as_of: input.as_of,
      turn: input.turn,
    });
  }

  const eventCause = eventCauseForTurn(input.turn);
  const recheckKind = recheckKindForTurn(input.turn);
  const registrySnapshot = ensurePolicyRegistryForTurn({
    responsibility_id: input.responsibility_id,
    adapters: input.adapters,
    as_of: input.as_of,
    turn: input.turn,
  });
  let registry: RuntimeRegistryV0;
  try {
    registry = readRuntimeRegistry(
      registrySnapshot,
      input.responsibility_id,
      input.turn.contract_revision,
      input.as_of,
      eventCause === "real-input",
    );
  } catch (error) {
    const contractRevision = receiptContractRevisionForTurn(
      registrySnapshot,
      input.turn.contract_revision,
    );
    if (contractRevision === undefined) {
      throw error;
    }

    return appendRuntimeBlockedReceipt({
      responsibility_id: input.responsibility_id,
      adapters: input.adapters,
      as_of: input.as_of,
      contract_revision: contractRevision,
      reason: error instanceof Error
        ? error.message
        : "active runtime policy is not executable",
      fix_target: "policy-artifact",
      interrupt_cause: "needs-judgment",
      event_cause: "escalation",
    });
  }

  const evidenceSelection = selectPlannedEvidenceInputs(
    registry.compiled_evidence_plan,
    input.turn.evidence ?? [],
  );
  if (!evidenceSelection.ok) {
    return appendRuntimeBlockedReceipt({
      responsibility_id: input.responsibility_id,
      adapters: input.adapters,
      as_of: input.as_of,
      contract_revision: registry.contract_revision,
      reason: evidenceSelection.reason,
      fix_target: evidenceSelection.fix_target,
      interrupt_cause: evidenceSelection.interrupt_cause,
      event_cause: "escalation",
      next_forecast_recheck: registry.forecast.receipt_next_forecast_recheck,
    });
  }

  const evidence = evidenceSelection.evidence;
  const dependencies = verifyDependencyReceipts(input.turn.dependency_receipts ?? []);
  const cycleCheck = detectReceiptCycles(
    receiptCycleEdgesFromDependencies(dependencies),
  );
  if (cycleCheck.has_cycle) {
    return appendRuntimeBlockedReceipt({
      responsibility_id: input.responsibility_id,
      adapters: input.adapters,
      as_of: input.as_of,
      contract_revision: registry.contract_revision,
      reason: "cycle-detected",
      fix_target: "composition.dependency_receipts",
      interrupt_cause: "needs-judgment",
      event_cause: "escalation",
      next_forecast_recheck: registry.forecast.receipt_next_forecast_recheck,
      cycle_checked: cycleCheck.cycle_checked,
    });
  }
  const memoKey = computeMemoKeyV0({
    contract_revision: registry.contract_revision,
    evidence_receipts: evidence.map((item) => item.content_hash),
    dependency_receipts: dependencies.map((item) => item.memo_ref),
  });
  const memoSource = shouldCheckMemo(input.turn)
    ? findReusableReceipt({
        receipts: input.adapters.storage.listReceipts(),
        responsibility_id: input.responsibility_id,
        contract_revision: registry.contract_revision,
        memo_key: memoKey,
        registry,
      })
    : undefined;

  if (memoSource !== undefined) {
    const memoHitReceipt = createMemoHitReceiptV0({
      source_receipt: memoSource,
      as_of: input.as_of,
      next_forecast_recheck: registry.forecast.receipt_next_forecast_recheck,
      event_cause: eventCause,
      ...(recheckKind === undefined ? {} : { recheck_kind: recheckKind }),
    });
    const verification = verifyReceiptV0(memoHitReceipt);
    if (!verification.ok) {
      throw new Error(`memo-hit receipt failed verification: ${verification.errors.join("; ")}`);
    }
    input.adapters.storage.appendReceipt(memoHitReceipt);

    return withForecastResult({
      accepted: true,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      receipt_hash: verification.content_hash,
      outcome: "memo-hit-receipt",
    }, registry.forecast);
  }

  const judge = runShallowJudgeV0({
    responsibility_id: input.responsibility_id,
    contract_revision: registry.contract_revision,
    policy_artifact_namespace: registry.policy_artifact_namespace,
    policy_artifact_revision: registry.policy_artifact_revision,
    ...(registry.policy_artifact_content_hash === undefined
      ? {}
      : { policy_artifact_content_hash: registry.policy_artifact_content_hash }),
    evidence,
    as_of: input.as_of,
    event_cause: eventCause,
    ...(recheckKind === undefined ? {} : { recheck_kind: recheckKind }),
    depth: "shallow",
    modelGateway: input.adapters.modelGateway,
  });
  const usage = judge.model_usage;
  const freshness = receiptFreshnessForRuntimeJudge({
    registry,
    dependencies,
    as_of: input.as_of,
  });
  const receipt = createReceiptV0({
    core: {
      responsibility_id: input.responsibility_id,
      contract_revision: registry.contract_revision,
      event_cause: eventCause,
      ...(recheckKind === undefined ? {} : { recheck_kind: recheckKind }),
      memo_key: memoKey,
      evidence_input_ids: evidence.map((item) => item.content_hash),
      as_of: input.as_of,
      role: "judge",
    },
    sig: createNullSignerReceiptSignatureV0(),
    verdict: judge.verdict,
    freshness: {
      ...freshness,
    },
    composition: {
      consumed_receipts: dependencies.map((item) => item.pin),
      cycle_checked: cycleCheck.cycle_checked,
    },
    cost: {
      provider: usage.provider,
      model: usage.model,
      role: "judge",
      tags: runtimeCostTags(judge.cost_tags.tags, registry, recheckKind),
      responsibility_id: input.responsibility_id,
      run_id: `judge-${input.as_of}`,
      as_of: input.as_of,
      tokens: usage.tokens,
      surprise_cause: eventCause,
      ...(usage.provider_norm === undefined
        ? {}
        : { provider_norm: usage.provider_norm }),
    },
  });
  const verification = verifyReceiptV0(receipt);
  if (!verification.ok) {
    throw new Error(`runtime receipt failed verification: ${verification.errors.join("; ")}`);
  }
  input.adapters.storage.appendReceipt(receipt);

  return withForecastResult({
    accepted: true,
    responsibility_id: input.responsibility_id,
    as_of: input.as_of,
    receipt_hash: verification.content_hash,
    outcome:
      eventCause === "forecast-recheck"
        ? "forecast-recheck-receipt"
        : "fresh-judge-receipt",
  }, registry.forecast);
}

function ingestEscalationTurn(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly turn: ReactorEscalationTurnV0;
}): ReactorIngestResultV0 {
  const registry = input.adapters.storage.readRegistry();
  const contractRevision = receiptContractRevisionForTurn(
    registry,
    input.turn.contract_revision,
  );
  if (contractRevision === undefined) {
    return {
      accepted: false,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "failed-before-write",
      errors: ["escalation requires contract_revision or registry.contract_revision"],
    };
  }

  const conflict =
    registry.contract_revision !== undefined &&
    input.turn.contract_revision !== undefined &&
    registry.contract_revision !== input.turn.contract_revision;

  return appendRuntimeBlockedReceipt({
    responsibility_id: input.responsibility_id,
    adapters: input.adapters,
    as_of: input.as_of,
    contract_revision: contractRevision,
    reason: conflict
      ? "escalation contract_revision conflicts with registry.contract_revision"
      : input.turn.reason,
    fix_target: conflict ? "contract-revision" : input.turn.fix_target,
    interrupt_cause: conflict ? "needs-judgment" : input.turn.interrupt_cause,
    event_cause: "escalation",
    next_forecast_recheck: optionalNextForecastRecheck(registry) ?? input.as_of,
  });
}

function ingestUnsupportedInput(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly event: unknown;
}): ReactorIngestResultV0 {
  const registry = input.adapters.storage.readRegistry();
  const contractRevision =
    contractRevisionFromUnknownEvent(input.event) ??
    receiptContractRevisionForTurn(registry, undefined);
  const reason = unsupportedInputReason(input.event);

  if (contractRevision === undefined) {
    return {
      accepted: false,
      responsibility_id: input.responsibility_id,
      as_of: input.as_of,
      outcome: "failed-before-write",
      errors: [reason],
    };
  }

  return appendRuntimeBlockedReceipt({
    responsibility_id: input.responsibility_id,
    adapters: input.adapters,
    as_of: input.as_of,
    contract_revision: contractRevision,
    reason,
    fix_target: "event.kind",
    interrupt_cause: "needs-judgment",
    event_cause: "escalation",
    next_forecast_recheck: optionalNextForecastRecheck(registry) ?? input.as_of,
  });
}

function appendRuntimeBlockedReceipt(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly contract_revision: ContentHashV0;
  readonly reason: string;
  readonly fix_target: string;
  readonly interrupt_cause: "needs-judgment" | "needs-input" | "contract-declared";
  readonly event_cause: ReceiptEventCauseV0;
  readonly next_forecast_recheck?: string;
  readonly cycle_checked?: boolean;
}): ReactorIngestResultV0 {
  const evidenceInputId = runtimeFailSafeEvidenceInputId({
    responsibility_id: input.responsibility_id,
    contract_revision: input.contract_revision,
    as_of: input.as_of,
    reason: input.reason,
    fix_target: input.fix_target,
    event_cause: input.event_cause,
  });
  const receipt = createKernelSafetyReceipt({
    responsibility_id: input.responsibility_id,
    contract_revision: input.contract_revision,
    memo_key: `runtime-fail-safe:${evidenceInputId}`,
    evidence_input_ids: [evidenceInputId],
    as_of: input.as_of,
    reason: input.reason,
    fix_target: input.fix_target,
    interrupt_cause: input.interrupt_cause,
    event_cause: input.event_cause,
    ...(input.next_forecast_recheck === undefined
      ? {}
      : { next_forecast_recheck: input.next_forecast_recheck }),
    ...(input.cycle_checked === undefined
      ? {}
      : { cycle_checked: input.cycle_checked }),
  });
  const verification = verifyReceiptV0(receipt);
  if (!verification.ok) {
    throw new Error(`blocked receipt failed verification: ${verification.errors.join("; ")}`);
  }
  input.adapters.storage.appendReceipt(receipt);

  return {
    accepted: true,
    responsibility_id: input.responsibility_id,
    as_of: input.as_of,
    receipt_hash: verification.content_hash,
    outcome: "blocked-escalation-receipt",
  };
}

function normalizeTurnInputV0(event: unknown): ReactorTurnInputV0 | undefined {
  if (!isRecord(event)) {
    return undefined;
  }

  if (event["kind"] === "real-input") {
    return {
      kind: "real-input",
      ...readTurnBase(event),
    };
  }
  if (event["kind"] === "forecast-recheck") {
    const recheckKind = event["recheck_kind"];
    if (recheckKind !== "evidence-age" && recheckKind !== "plan-age") {
      throw new Error("forecast-recheck requires recheck_kind");
    }
    return {
      kind: "forecast-recheck",
      recheck_kind: recheckKind,
      ...readTurnBase(event),
    };
  }
  if (event["kind"] === "escalation") {
    const interruptCause = event["interrupt_cause"];
    if (
      interruptCause !== "needs-judgment" &&
      interruptCause !== "needs-input" &&
      interruptCause !== "contract-declared"
    ) {
      throw new Error("escalation requires a valid interrupt_cause");
    }
    return {
      kind: "escalation",
      interrupt_cause: interruptCause,
      reason: readNonEmptyString(event["reason"]) ?? "runtime escalation",
      fix_target: readNonEmptyString(event["fix_target"]) ?? "author",
      ...readTurnBase(event),
    };
  }

  return undefined;
}

function readTurnBase(event: Readonly<Record<string, unknown>>): ReactorTurnBaseV0 {
  const contractRevision = event["contract_revision"];
  const base: {
    contract_revision?: ContentHashV0;
    cold_start?: ColdStartPolicyInputV0;
    evidence?: readonly ReactorEvidenceInputV0[];
    dependency_receipts?: readonly ReceiptV0[];
  } = {};

  if (isContentHash(contractRevision)) {
    base.contract_revision = contractRevision;
  }
  if (event["cold_start"] !== undefined) {
    base.cold_start = readColdStartPolicyInput(event["cold_start"]);
  }
  if (event["evidence"] !== undefined) {
    base.evidence = readEvidenceArray(event["evidence"]);
  }
  if (event["dependency_receipts"] !== undefined) {
    base.dependency_receipts = readDependencyReceiptArray(
      event["dependency_receipts"],
    );
  }

  return base;
}

function ensurePolicyRegistryForTurn(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly turn: ReactorRealInputTurnV0 | ReactorForecastRecheckTurnV0;
}): ReactorRegistrySnapshotV0 {
  const registry = input.adapters.storage.readRegistry();
  if (hasActivePolicyArtifact(registry)) {
    return registry;
  }

  if (input.turn.kind !== "real-input") {
    return registry;
  }

  return authorAndPersistColdStartPolicyRegistry({
    responsibility_id: input.responsibility_id,
    adapters: input.adapters,
    as_of: input.as_of,
    registry,
    turn: input.turn,
  });
}

function authorAndPersistColdStartPolicyRegistry(input: {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
  readonly registry: ReactorRegistrySnapshotV0;
  readonly turn: ReactorRealInputTurnV0;
}): ReactorRegistrySnapshotV0 {
  const coldStart = input.turn.cold_start;
  if (coldStart === undefined) {
    throw new Error("cold_start is required before first runtime policy ingest");
  }

  const writeRegistry = input.adapters.storage.writeRegistry;
  if (typeof writeRegistry !== "function") {
    throw new Error("storage.writeRegistry is required for cold_start policy persistence");
  }

  if (
    input.turn.contract_revision !== undefined &&
    input.turn.contract_revision !== coldStart.contract_revision
  ) {
    throw new Error("cold_start contract_revision conflicts with event contract_revision");
  }
  if (
    input.registry.contract_revision !== undefined &&
    input.registry.contract_revision !== coldStart.contract_revision
  ) {
    throw new Error("cold_start contract_revision conflicts with registry.contract_revision");
  }
  if (coldStart.compiled_evidence_plan.responsibility_id !== input.responsibility_id) {
    throw new Error("cold_start compiled_evidence_plan responsibility_id conflicts");
  }
  if (coldStart.forecast_schedule.responsibility_id !== input.responsibility_id) {
    throw new Error("cold_start forecast_schedule responsibility_id conflicts");
  }

  const authoredRegistry = authorPolicyArtifactV0({
    responsibility_id: input.responsibility_id,
    contract_revision: coldStart.contract_revision,
    contract_summary: coldStart.contract_summary.summary,
    no_anchor: coldStart.no_anchor,
    live_observables: coldStart.live_observables,
    receipt_history: input.adapters.storage.listReceipts(),
    agentSdk: input.adapters.agentSdk,
    ...(coldStart.policy_artifact_namespace === undefined
      ? {}
      : { policy_artifact_namespace: coldStart.policy_artifact_namespace }),
  });

  assertColdStartTargetsAuthoredPolicy(coldStart, authoredRegistry);

  writeRegistry({
    ...input.registry,
    ...authoredRegistry,
    contract_summary: coldStart.contract_summary,
    compiled_evidence_plan: coldStart.compiled_evidence_plan,
    forecast_schedule: coldStart.forecast_schedule,
    last_policy_revalidated_at: input.as_of,
    last_recompile_at: input.as_of,
    last_policy_recompile_at: input.as_of,
  });

  const persistedRegistry = input.adapters.storage.readRegistry();
  if (!hasActivePolicyArtifact(persistedRegistry)) {
    throw new Error("storage.writeRegistry did not persist cold_start policy registry");
  }
  if (persistedRegistry.compiled_evidence_plan === undefined) {
    throw new Error("storage.writeRegistry did not persist cold_start compiled_evidence_plan");
  }
  if (persistedRegistry.forecast_schedule === undefined) {
    throw new Error("storage.writeRegistry did not persist cold_start forecast_schedule");
  }

  return persistedRegistry;
}

function hasActivePolicyArtifact(registry: ReactorRegistrySnapshotV0): boolean {
  return (
    typeof registry.policy_artifact_namespace === "string" &&
    registry.policy_artifact_namespace.length > 0 &&
    registry.policy_artifact_namespace !== UNINITIALIZED_POLICY_NAMESPACE &&
    typeof registry.policy_artifact_revision === "string" &&
    registry.policy_artifact_revision.length > 0 &&
    registry.policy_artifact_revision !== UNINITIALIZED_POLICY_REVISION
  );
}

function hasValidatedPolicyPosture(
  registry: ReactorRegistrySnapshotV0,
): boolean {
  const validationState =
    registry.policy_artifact_validation_state ?? registry.validation_state;
  if (validationState === "validated") {
    return true;
  }
  return isRecord(validationState) && validationState["status"] === "validated";
}

function assertColdStartTargetsAuthoredPolicy(
  coldStart: ColdStartPolicyInputV0,
  authoredRegistry: ReactorRegistrySnapshotV0,
): void {
  if (authoredRegistry.contract_revision !== coldStart.contract_revision) {
    throw new Error("authored policy contract_revision conflicts with cold_start");
  }
  if (
    coldStart.compiled_evidence_plan.policy_artifact_namespace !==
    authoredRegistry.policy_artifact_namespace
  ) {
    throw new Error("cold_start compiled_evidence_plan namespace conflicts with authored policy");
  }
  if (
    coldStart.compiled_evidence_plan.policy_artifact_revision !==
    authoredRegistry.policy_artifact_revision
  ) {
    throw new Error("cold_start compiled_evidence_plan revision conflicts with authored policy");
  }
}

function assertCompiledEvidencePlanMatchesRegistry(input: {
  readonly plan: CompiledEvidencePlan;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
}): void {
  if (input.plan.responsibility_id !== input.responsibility_id) {
    throw new Error("registry.compiled_evidence_plan responsibility_id conflicts with runtime responsibility_id");
  }
  if (input.plan.contract_revision !== input.contract_revision) {
    throw new Error("registry.compiled_evidence_plan contract_revision conflicts with registry.contract_revision");
  }
  if (
    input.plan.policy_artifact_namespace !==
    input.policy_artifact_namespace
  ) {
    throw new Error("registry.compiled_evidence_plan namespace conflicts with active policy");
  }
  if (input.plan.policy_artifact_revision !== input.policy_artifact_revision) {
    throw new Error("registry.compiled_evidence_plan revision conflicts with active policy");
  }
}

function readRuntimeRegistry(
  registry: ReactorRegistrySnapshotV0,
  responsibilityId: string,
  eventContractRevision: ContentHashV0 | undefined,
  asOf: string,
  realInputObserved: boolean,
): RuntimeRegistryV0 {
  const contractRevision = registry.contract_revision ?? eventContractRevision;
  if (!isContentHash(contractRevision)) {
    throw new Error("registry.contract_revision is required for runtime ingest");
  }
  if (
    eventContractRevision !== undefined &&
    registry.contract_revision !== undefined &&
    registry.contract_revision !== eventContractRevision
  ) {
    throw new Error("event contract_revision conflicts with registry.contract_revision");
  }
  if (!hasActivePolicyArtifact(registry)) {
    throw new Error("registry active policy artifact is required for runtime ingest");
  }
  if (!hasValidatedPolicyPosture(registry)) {
    throw new Error("registry.policy_artifact_validation_state must be validated for runtime ingest");
  }

  const compiledEvidencePlan = readCompiledEvidencePlan(
    registry.compiled_evidence_plan,
    "registry.compiled_evidence_plan",
  );
  assertCompiledEvidencePlanMatchesRegistry({
    plan: compiledEvidencePlan,
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    policy_artifact_namespace: registry.policy_artifact_namespace,
    policy_artifact_revision: registry.policy_artifact_revision,
  });

  const forecastSchedule = readForecastSchedule(registry.forecast_schedule);
  if (forecastSchedule.responsibility_id !== responsibilityId) {
    throw new Error("registry.forecast_schedule responsibility_id conflicts with runtime responsibility_id");
  }
  if (forecastSchedule.contract_revision !== contractRevision) {
    throw new Error("registry.forecast_schedule contract_revision conflicts with registry.contract_revision");
  }
  const forecastResult = evaluateForecastScheduleV0({
    as_of: asOf,
    schedule: forecastSchedule,
    real_input_observed: realInputObserved,
  });
  const receiptNextForecastRecheck =
    forecastResult.next_due_at ??
    earliestInstant([
      forecastSchedule.next_evidence_recheck,
      forecastSchedule.next_plan_recheck,
    ]) ??
    asOf;

  return {
    contract_revision: contractRevision,
    policy_artifact_namespace: registry.policy_artifact_namespace,
    policy_artifact_revision: registry.policy_artifact_revision,
    ...(registry.policy_artifact_content_hash === undefined
      ? {}
      : { policy_artifact_content_hash: registry.policy_artifact_content_hash }),
    transitive_freshness_function:
      normalizePolicyTransitiveFreshnessFunctionV0(
        registry.transitive_freshness_function,
        "registry.transitive_freshness_function",
      ),
    compiled_evidence_plan: compiledEvidencePlan,
    forecast_schedule: forecastSchedule,
    forecast: {
      ...(forecastResult.next_due_at === undefined
        ? {}
        : { next_due_at: forecastResult.next_due_at }),
      due_rechecks: forecastResult.due_rechecks,
      receipt_next_forecast_recheck: receiptNextForecastRecheck,
    },
  };
}

function eventCauseForTurn(
  turn: ReactorRealInputTurnV0 | ReactorForecastRecheckTurnV0,
): ReceiptEventCauseV0 {
  return turn.kind;
}

function recheckKindForTurn(
  turn: ReactorRealInputTurnV0 | ReactorForecastRecheckTurnV0,
): ReceiptRecheckKindV0 | undefined {
  return turn.kind === "forecast-recheck" ? turn.recheck_kind : undefined;
}

function shouldCheckMemo(
  turn: ReactorRealInputTurnV0 | ReactorForecastRecheckTurnV0,
): boolean {
  return !(turn.kind === "forecast-recheck" && turn.recheck_kind === "plan-age");
}

function readPlannedAdapterEvidence(input: {
  readonly plan: CompiledEvidencePlan;
  readonly adapters: ReactorAdaptersV0;
  readonly as_of: string;
}): readonly ReactorEvidenceInputV0[] {
  const evidence: ReactorEvidenceInputV0[] = [];

  for (const source of input.plan.sources) {
    if (source.kind !== "adapter") {
      continue;
    }

    const response = input.adapters.connectors.read({
      source_id: source.id,
      as_of: input.as_of,
    });
    evidence.push(evidenceFromConnectorResponse(source.id, response));
  }

  return evidence;
}

function evidenceFromConnectorResponse(
  sourceId: string,
  response: ReactorConnectorResponseV0,
): ReactorEvidenceInputV0 {
  const responseContentHash =
    response.content_hash ??
    response.payload_hash ??
    contentHashFromPayload(response.payload);
  const receipt = response.receipt;

  if (receipt !== undefined) {
    return {
      source_id: sourceId,
      receipt,
      ...(responseContentHash === undefined
        ? {}
        : { content_hash: responseContentHash }),
    };
  }

  if (responseContentHash !== undefined) {
    return {
      source_id: sourceId,
      content_hash: responseContentHash,
    };
  }

  return {
    source_id: sourceId,
    payload: response.payload,
  };
}

function contentHashFromPayload(payload: unknown): ContentHashV0 | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const payloadHash = payload["payload_hash"] ?? payload["content_hash"];
  return isContentHash(payloadHash) ? payloadHash : undefined;
}

function selectPlannedEvidenceInputs(
  plan: CompiledEvidencePlan,
  evidence: readonly ReactorEvidenceInputV0[],
): PlannedEvidenceSelectionV0 {
  const plannedSourceIds = new Set(plan.sources.map((source) => source.id));
  const evidenceBySourceId = new Map<string, ReactorEvidenceInputV0>();

  for (const item of evidence) {
    if (!plannedSourceIds.has(item.source_id)) {
      continue;
    }
    if (evidenceBySourceId.has(item.source_id)) {
      return {
        ok: false,
        reason: `event evidence duplicates planned source ${item.source_id}`,
        fix_target: `evidence.${item.source_id}`,
        interrupt_cause: "needs-input",
      };
    }
    evidenceBySourceId.set(item.source_id, item);
  }

  const selected: NormalizedEvidenceInputV0[] = [];
  for (const source of plan.sources) {
    const item = evidenceBySourceId.get(source.id);
    if (item === undefined) {
      if (!source.required) {
        continue;
      }
      return {
        ok: false,
        reason: `planned source ${source.id} is required but missing from event evidence`,
        fix_target: `evidence.${source.id}`,
        interrupt_cause: "needs-input",
      };
    }

    try {
      selected.push({
        source_id: source.id,
        content_hash: evidenceContentHash(item),
      });
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error
          ? error.message
          : `planned source ${source.id} is malformed`,
        fix_target: `evidence.${source.id}`,
        interrupt_cause: "needs-input",
      };
    }
  }

  return { ok: true, evidence: selected };
}

function evidenceContentHash(input: ReactorEvidenceInputV0): ContentHashV0 {
  if (input.receipt !== undefined) {
    const verification = verifyReceiptV0(input.receipt);
    if (!verification.ok) {
      throw new Error(`evidence receipt ${input.source_id} failed verification`);
    }
    if (
      input.content_hash !== undefined &&
      input.content_hash !== verification.content_hash
    ) {
      throw new Error(`evidence receipt ${input.source_id} content_hash conflicts`);
    }
    return verification.content_hash;
  }
  if (isContentHash(input.content_hash)) {
    return input.content_hash;
  }
  if (Object.hasOwn(input, "payload")) {
    return hashCanonicalReceiptV0(
      canonicalizeForReceiptV0({
        schema: "openprose.reactor.evidence-input",
        v: 0,
        source_id: input.source_id,
        payload: input.payload,
      }),
    );
  }

  throw new Error(`evidence ${input.source_id} must carry a receipt, content_hash, or payload`);
}

function verifyDependencyReceipts(
  receipts: readonly ReceiptV0[],
): readonly VerifiedDependencyReceiptV0[] {
  return receipts.map((receipt) => {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      throw new Error("dependency receipt failed verification");
    }

    const signerPosture = receipt.sig.scheme === "none" ? "none" : receipt.sig.scheme;
    return {
      receipt,
      content_hash: verification.content_hash,
      memo_ref: {
        upstream_content_hash: verification.content_hash,
        contract_revision: receipt.core.contract_revision,
        acceptable_signer_set: [signerPosture],
      },
      pin: {
        upstream_content_hash: verification.content_hash,
        contract_revision: receipt.core.contract_revision,
        acceptable_signer_set: [signerPosture],
      },
    };
  });
}

function receiptCycleEdgesFromDependencies(
  dependencies: readonly VerifiedDependencyReceiptV0[],
): readonly ConsumedReceiptEdge[] {
  const receiptEdges = dependencies.flatMap((dependency) =>
    dependency.receipt.composition.consumed_receipts.map((upstream) => ({
      from: dependency.content_hash,
      to: upstream.upstream_content_hash,
    })),
  );
  // The current receipt hash is not available before creation, so B4 also
  // checks the contract-revision lineage present in dependency pins. This makes
  // A->B->A composition cycles observable before accepting a new receipt.
  const contractRevisionEdges = dependencies.flatMap((dependency) =>
    dependency.receipt.composition.consumed_receipts.map((upstream) => ({
      from: dependency.receipt.core.contract_revision,
      to: upstream.contract_revision,
    })),
  );

  return [...receiptEdges, ...contractRevisionEdges];
}

function receiptFreshnessForRuntimeJudge(input: {
  readonly registry: RuntimeRegistryV0;
  readonly dependencies: readonly VerifiedDependencyReceiptV0[];
  readonly as_of: string;
}): ReceiptFreshnessV0 {
  const nextForecastRecheck =
    input.registry.forecast.receipt_next_forecast_recheck;
  if (input.dependencies.length === 0) {
    return {
      as_of: input.as_of,
      next_forecast_recheck: nextForecastRecheck,
    };
  }

  return createComposedReceiptFreshnessV0({
    as_of: input.as_of,
    next_forecast_recheck: nextForecastRecheck,
    transitive_freshness_policy_ref: transitiveFreshnessPolicyRef(input.registry),
    transitive_freshness_function: input.registry.transitive_freshness_function,
    consumed_receipts: input.dependencies.map((dependency) => ({
      upstream_receipt: dependency.receipt,
      dependency_pin: dependency.pin,
    })),
  });
}

function transitiveFreshnessPolicyRef(registry: RuntimeRegistryV0): string {
  return `${registry.policy_artifact_namespace}@${registry.policy_artifact_revision}`;
}

function findReusableReceipt(input: {
  readonly receipts: readonly ReceiptV0[];
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly memo_key: ContentHashV0;
  readonly registry: RuntimeRegistryV0;
}): ReceiptV0 | undefined {
  const candidates = input.receipts.filter((receipt) => {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      return false;
    }

    return (
      receipt.core.responsibility_id === input.responsibility_id &&
      receipt.core.contract_revision === input.contract_revision &&
      receipt.core.memo_key === input.memo_key &&
      receipt.core.role === "judge" &&
      receipt.cost.provider !== "memo" &&
      receipt.cost.tags.includes(memoSourceTag(input.registry)) &&
      receipt.cost.tokens.fresh + receipt.cost.tokens.reused > 0
    );
  });

  return candidates.sort(compareReceiptsNewestFirst)[0];
}

function compareReceiptsNewestFirst(left: ReceiptV0, right: ReceiptV0): number {
  const byTime = Date.parse(right.core.as_of) - Date.parse(left.core.as_of);
  if (byTime !== 0) {
    return byTime;
  }

  return right.content_hash.localeCompare(left.content_hash);
}

function memoSourceTag(registry: RuntimeRegistryV0): string {
  return `${RUNTIME_MEMO_SOURCE_TAG_PREFIX}${registry.policy_artifact_namespace}@${registry.policy_artifact_revision}`;
}

function runtimeCostTags(
  judgeTags: readonly string[],
  registry: RuntimeRegistryV0,
  recheckKind: ReceiptRecheckKindV0 | undefined,
): readonly string[] {
  return [
    ...judgeTags,
    ...(recheckKind === undefined ? [] : ["forecast-recheck", recheckKind]),
    memoSourceTag(registry),
  ];
}

function withForecastResult(
  result: Omit<ReactorIngestResultV0, "next_due_at" | "due_rechecks">,
  forecast: RuntimeForecastStateV0,
): ReactorIngestResultV0 {
  return {
    ...result,
    ...(forecast.next_due_at === undefined
      ? {}
      : { next_due_at: forecast.next_due_at }),
    due_rechecks: forecast.due_rechecks,
  };
}

function receiptContractRevisionForTurn(
  registry: ReactorRegistrySnapshotV0,
  eventContractRevision: ContentHashV0 | undefined,
): ContentHashV0 | undefined {
  if (isContentHash(registry.contract_revision)) {
    return registry.contract_revision;
  }
  return eventContractRevision;
}

function contractRevisionFromUnknownEvent(
  event: unknown,
): ContentHashV0 | undefined {
  if (!isRecord(event)) {
    return undefined;
  }
  if (isContentHash(event["contract_revision"])) {
    return event["contract_revision"];
  }
  const coldStart = event["cold_start"];
  if (isRecord(coldStart) && isContentHash(coldStart["contract_revision"])) {
    return coldStart["contract_revision"];
  }
  return undefined;
}

function optionalNextForecastRecheck(
  registry: ReactorRegistrySnapshotV0,
): string | undefined {
  try {
    const schedule = readForecastSchedule(registry.forecast_schedule);
    return earliestInstant([
      schedule.next_evidence_recheck,
      schedule.next_plan_recheck,
    ]);
  } catch {
    return undefined;
  }
}

function unsupportedInputReason(event: unknown): string {
  if (!isRecord(event)) {
    return "unsupported reactor ingest input";
  }
  const kind = event["kind"];
  return typeof kind === "string" && kind.length > 0
    ? `unsupported reactor ingest kind ${kind}`
    : "unsupported reactor ingest input";
}

function runtimeFailSafeEvidenceInputId(input: {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly reason: string;
  readonly fix_target: string;
  readonly event_cause: ReceiptEventCauseV0;
}): ContentHashV0 {
  return hashCanonicalReceiptV0(
    canonicalizeForReceiptV0({
      schema: "openprose.reactor.runtime-fail-safe-input",
      v: 0,
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      as_of: input.as_of,
      reason: input.reason,
      fix_target: input.fix_target,
      event_cause: input.event_cause,
    }),
  );
}

function emitIngest(
  responsibilityId: string,
  adapters: ReactorAdaptersV0,
  asOf: string,
  event: unknown,
): void {
  const sdkEvent: ReactorSdkEventV0 = {
    type: "ingest",
    responsibility_id: responsibilityId,
    as_of: asOf,
    payload: event,
  };
  adapters.eventSink.emit(sdkEvent);
}

function isEvidenceInput(value: unknown): value is ReactorEvidenceInputV0 {
  return (
    isRecord(value) &&
    typeof value["source_id"] === "string" &&
    value["source_id"].length > 0
  );
}

function readEvidenceArray(value: unknown): readonly ReactorEvidenceInputV0[] {
  if (!Array.isArray(value)) {
    throw new Error("real-input evidence must be an array when present");
  }

  return value.map((item, index) => {
    if (!isEvidenceInput(item)) {
      throw new Error(`evidence[${index}] must carry a non-empty source_id`);
    }
    return item;
  });
}

function readDependencyReceiptArray(value: unknown): readonly ReceiptV0[] {
  if (!Array.isArray(value)) {
    throw new Error("dependency_receipts must be an array when present");
  }

  return value.map((item, index) => {
    const verification = verifyReceiptV0(item);
    if (!verification.ok) {
      throw new Error(`dependency_receipts[${index}] failed verification`);
    }
    return item as ReceiptV0;
  });
}

function readColdStartPolicyInput(value: unknown): ColdStartPolicyInputV0 {
  if (!isRecord(value)) {
    throw new Error("cold_start must be an object");
  }

  const contractRevision = readContentHashField(value, "contract_revision", "cold_start");
  const contractSummary = readContractSummaryProjection(
    value["contract_summary"],
  );
  if (contractSummary.source_contract_revision !== contractRevision) {
    throw new Error("cold_start contract_summary conflicts with contract_revision");
  }

  const noAnchor = value["no_anchor"];
  if (typeof noAnchor !== "boolean") {
    throw new Error("cold_start.no_anchor must be boolean");
  }

  const liveObservables = readPolicyLiveObservables(value["live_observables"]);
  const compiledEvidencePlan = readCompiledEvidencePlan(
    value["compiled_evidence_plan"],
  );
  if (compiledEvidencePlan.contract_revision !== contractRevision) {
    throw new Error("cold_start compiled_evidence_plan contract_revision conflicts");
  }

  const forecastSchedule = readColdStartForecastSchedule(value["forecast_schedule"]);
  if (forecastSchedule.contract_revision !== contractRevision) {
    throw new Error("cold_start forecast_schedule contract_revision conflicts");
  }

  const namespace = value["policy_artifact_namespace"];
  if (namespace !== undefined && (typeof namespace !== "string" || namespace.length === 0)) {
    throw new Error("cold_start.policy_artifact_namespace must be non-empty when supplied");
  }

  return {
    contract_revision: contractRevision,
    contract_summary: contractSummary,
    no_anchor: noAnchor,
    live_observables: liveObservables,
    compiled_evidence_plan: compiledEvidencePlan,
    forecast_schedule: forecastSchedule,
    ...(namespace === undefined ? {} : { policy_artifact_namespace: namespace }),
  };
}

function readContractSummaryProjection(
  value: unknown,
): ContractSummaryProjectionV0 {
  if (!isRecord(value)) {
    throw new Error("cold_start.contract_summary must be an object");
  }

  const summary = readNonEmptyString(value["summary"]);
  if (summary === undefined) {
    throw new Error("cold_start.contract_summary.summary must be non-empty");
  }

  return {
    summary,
    source_contract_revision: readContentHashField(
      value,
      "source_contract_revision",
      "cold_start.contract_summary",
    ),
    projection_hash: readContentHashField(
      value,
      "projection_hash",
      "cold_start.contract_summary",
    ),
  };
}

function readPolicyLiveObservables(
  value: unknown,
): readonly PolicyLiveObservableV0[] {
  if (!Array.isArray(value)) {
    throw new Error("cold_start.live_observables must be an array");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`cold_start.live_observables[${index}] must be an object`);
    }

    const id = readNonEmptyString(item["id"]);
    if (id === undefined) {
      throw new Error(`cold_start.live_observables[${index}].id must be non-empty`);
    }
    const source = item["source"];
    if (
      typeof source !== "string" ||
      !POLICY_LIVE_OBSERVABLE_SOURCES.has(source)
    ) {
      throw new Error(`cold_start.live_observables[${index}].source is malformed`);
    }
    const description = readNonEmptyString(item["description"]);
    if (description === undefined) {
      throw new Error(
        `cold_start.live_observables[${index}].description must be non-empty`,
      );
    }

    return {
      id,
      source: source as PolicyLiveObservableV0["source"],
      description,
    };
  });
}

function readCompiledEvidencePlan(
  value: unknown,
  path = "cold_start.compiled_evidence_plan",
): CompiledEvidencePlan {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }

  const sources = readCompiledEvidenceSources(value["sources"], path);
  const plan: CompiledEvidencePlan = {
    responsibility_id: readNonEmptyString(value["responsibility_id"]) ?? "",
    contract_revision: readUnknownContentHash(value["contract_revision"]),
    policy_artifact_namespace:
      readNonEmptyString(value["policy_artifact_namespace"]) ?? "",
    policy_artifact_revision:
      readNonEmptyString(value["policy_artifact_revision"]) ?? "",
    plan_revision: readNonEmptyString(value["plan_revision"]) ?? "",
    as_of: readNonEmptyString(value["as_of"]) ?? "",
    evidence_order: readEvidenceReceiptOrder(
      value["evidence_order"],
      `${path}.evidence_order`,
    ),
    sources,
  };
  const errors = validateCompiledEvidencePlan(plan);
  if (errors.length > 0) {
    throw new Error(
      `${path} is malformed: ${errors.join("; ")}`,
    );
  }

  return plan;
}

function readCompiledEvidenceSources(
  value: unknown,
  path: string,
): readonly CompiledEvidenceSource[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path}.sources must be an array`);
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(
        `${path}.sources[${index}] must be an object`,
      );
    }
    const id = readNonEmptyString(item["id"]) ?? "";
    const kind = item["kind"];
    const required = item["required"];
    const receiptOrder = item["receipt_order"];
    if (kind !== "adapter" && kind !== "forecast" && kind !== "dependency") {
      throw new Error(
        `${path}.sources[${index}].kind is malformed`,
      );
    }
    if (typeof required !== "boolean") {
      throw new Error(
        `${path}.sources[${index}].required must be boolean`,
      );
    }
    if (
      receiptOrder !== undefined &&
      receiptOrder !== "unordered" &&
      receiptOrder !== "declared"
    ) {
      throw new Error(
        `${path}.sources[${index}].receipt_order is malformed`,
      );
    }

    return {
      id,
      kind,
      required,
      ...(receiptOrder === "unordered" || receiptOrder === "declared"
        ? { receipt_order: receiptOrder }
        : {}),
    };
  });
}

function readEvidenceReceiptOrder(
  value: unknown,
  path: string,
): CompiledEvidencePlan["evidence_order"] {
  if (value !== "unordered" && value !== "declared") {
    throw new Error(`${path} is malformed`);
  }

  return value;
}

function readColdStartForecastSchedule(value: unknown): ForecastScheduleStateV0 {
  try {
    return readForecastSchedule(value);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message.replace("registry.forecast_schedule", "cold_start.forecast_schedule")
        : "cold_start.forecast_schedule is malformed",
    );
  }
}

function readContentHashField(
  value: Readonly<Record<string, unknown>>,
  field: string,
  path: string,
): ContentHashV0 {
  const item = value[field];
  if (!isContentHash(item)) {
    throw new Error(`${path}.${field} must be a sha256 content address`);
  }

  return item;
}

function readUnknownContentHash(value: unknown): ContentHashV0 {
  return isContentHash(value) ? value : ("" as ContentHashV0);
}

function isContentHash(value: unknown): value is ContentHashV0 {
  return typeof value === "string" && CONTENT_HASH_PATTERN.test(value);
}

function isReplayableInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function earliestInstant(values: readonly string[]): string | undefined {
  const parsed = values.map((value) => ({
    value,
    ms: Date.parse(value),
  }));
  if (parsed.some((item) => !Number.isFinite(item.ms))) {
    return undefined;
  }

  return parsed.sort((left, right) => left.ms - right.ms)[0]?.value;
}

function readForecastSchedule(schedule: unknown): ForecastScheduleStateV0 {
  if (!isRecord(schedule)) {
    throw new Error("registry.forecast_schedule is required for runtime ingest");
  }
  const responsibilityId = schedule["responsibility_id"];
  const contractRevision = schedule["contract_revision"];
  const memoKey = schedule["memo_key"];
  const evidenceInputIds = schedule["evidence_input_ids"];
  const nextEvidenceRecheck = schedule["next_evidence_recheck"];
  const nextPlanRecheck = schedule["next_plan_recheck"];
  if (
    typeof responsibilityId !== "string" ||
    responsibilityId.length === 0 ||
    !isContentHash(contractRevision) ||
    typeof memoKey !== "string" ||
    memoKey.length === 0 ||
    !Array.isArray(evidenceInputIds) ||
    !evidenceInputIds.every(isContentHash) ||
    typeof nextEvidenceRecheck !== "string" ||
    typeof nextPlanRecheck !== "string" ||
    earliestInstant([nextEvidenceRecheck, nextPlanRecheck]) === undefined
  ) {
    throw new Error("registry.forecast_schedule must be replayable for runtime ingest");
  }

  return {
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    memo_key: memoKey,
    evidence_input_ids: evidenceInputIds,
    next_evidence_recheck: nextEvidenceRecheck,
    next_plan_recheck: nextPlanRecheck,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
