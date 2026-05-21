import {
  KERNEL_BACKSTOPS,
  KERNEL_DAY_MS,
  compareRollback,
  evaluateBackstops,
  evaluatePredicate,
  judgedActivations,
  type JudgedActivations,
  type KernelBackstopEvaluation,
  type KernelBackstopName,
  type KernelFacts,
  type KernelPolicyArtifactValidation,
  type KernelPredicateExpression,
  type PredicateEvaluation,
  type RollbackOutcome,
  validateKernelPolicyArtifact,
} from "../kernel";
import {
  type ContentHashV0,
  type ReceiptEventCauseV0,
  type ReceiptRoleV0,
  type ReceiptV0,
  type ReceiptVerdictStatusV0,
  canonicalizeForReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} from "../receipt";
import type {
  ReactorAgentSdkAdapterV0,
  ReactorRegistrySnapshotV0,
} from "../sdk";

export const POLICY_ARTIFACT_SCHEMA =
  "openprose.reactor.policy-artifact" as const;
export const POLICY_ARTIFACT_VERSION = 0 as const;
export const POLICY_AUTHOR_REQUEST_SCHEMA =
  "openprose.reactor.policy-author.request" as const;
export const POLICY_AUTHOR_HISTORY_QUERY_SCHEMA =
  "openprose.reactor.policy-author.history-query" as const;
export const POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA =
  "openprose.reactor.policy-author.artifact-response" as const;
export const POLICY_ARTIFACT_VALIDATOR_ID =
  "@openprose/reactor/policy.validatePolicyArtifactV0" as const;
export const POLICY_DRIFT_FACTS_SCHEMA =
  "openprose.reactor.policy-drift.facts" as const;
export const POLICY_DRIFT_EVALUATION_SCHEMA =
  "openprose.reactor.policy-drift.evaluation" as const;
export const POLICY_RECOMPILE_DECISION_SCHEMA =
  "openprose.reactor.policy-recompile.decision" as const;
export const POLICY_RECOMPILE_EXECUTION_SCHEMA =
  "openprose.reactor.policy-recompile.execution" as const;
export const POLICY_ROLLBACK_DECISION_SCHEMA =
  "openprose.reactor.policy-rollback.decision" as const;
export const POLICY_DRIFT_FACT_IDS_V0 = [
  "cost.fresh_tokens_per_maintained_day",
  "receipt.escalation_precision_7d",
  "kernel.deep_shallow_contradiction_count_7d",
] as const;

export type PolicyLiveObservableSourceV0 =
  | "connector"
  | "receipt-log"
  | "kernel-backstop"
  | "cost-ledger"
  | "human-label-stream";
export type PolicyDriftKnownFactIdV0 =
  (typeof POLICY_DRIFT_FACT_IDS_V0)[number];

export interface PolicyLiveObservableV0 {
  readonly id: string;
  readonly source: PolicyLiveObservableSourceV0;
  readonly description: string;
}

export interface PolicyCadenceV0 {
  readonly shallow_recheck_ms: number;
  readonly plan_audit_ms: number;
  readonly deep_revalidation_ms: number;
}

export interface PolicyHysteresisV0 {
  readonly min_recompile_interval_ms: number;
  readonly enter_degraded_threshold: number;
  readonly exit_degraded_threshold: number;
  readonly warmup_judged_activations: number;
}

export interface PolicyThresholdsV0 {
  readonly max_calibration_divergence_multiplier: number;
  readonly escalation_precision_floor: number;
  readonly backstop_deep_contradiction_count: number;
  readonly stale_brief_minutes: number;
  readonly fresh_tokens_per_day_ceiling: number;
}

export type PolicyTransitiveFreshnessFunctionV0 =
  | {
      readonly kind: "kernel-default";
    }
  | {
      readonly kind: "minimum-remaining-freshness-ms";
      readonly minimum_remaining_ms: number;
    };

export const DEFAULT_TRANSITIVE_FRESHNESS_FUNCTION_V0: PolicyTransitiveFreshnessFunctionV0 =
  Object.freeze({
    kind: "kernel-default",
  });

export interface PolicyAuthorReceiptSummaryV0 {
  readonly content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly role: ReceiptRoleV0;
  readonly event_cause: ReceiptEventCauseV0;
  readonly verdict_status: ReceiptVerdictStatusV0;
  readonly next_forecast_recheck: string;
  readonly surprise_cause: ReceiptEventCauseV0;
}

export interface PolicyAuthorHistoryQueryV0 {
  readonly schema: typeof POLICY_AUTHOR_HISTORY_QUERY_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly selected_receipt_hashes: readonly ContentHashV0[];
  readonly rationale?: string;
}

export interface PolicyArtifactProvenanceV0 {
  readonly contract_revision: ContentHashV0;
  readonly receipt_history_summary_hash: ContentHashV0;
  readonly explored_receipt_hashes: readonly ContentHashV0[];
  readonly history_query: PolicyAuthorHistoryQueryV0;
}

export interface AuthoredPolicyArtifactV0 {
  readonly schema: typeof POLICY_ARTIFACT_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly responsibility_id: string;
  readonly registry_id: string;
  readonly policy_revision: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly cadence: PolicyCadenceV0;
  readonly hysteresis: PolicyHysteresisV0;
  readonly thresholds: PolicyThresholdsV0;
  readonly transitive_freshness_function: PolicyTransitiveFreshnessFunctionV0;
  readonly falsification_predicate: KernelPredicateExpression;
  readonly backstop_divergence_predicate?: KernelPredicateExpression;
  readonly provenance: PolicyArtifactProvenanceV0;
}

export interface PolicyAuthorHistoryQueryRequestV0 {
  readonly schema: typeof POLICY_AUTHOR_REQUEST_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly step: "history-query";
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly receipt_history_summary: readonly PolicyAuthorReceiptSummaryV0[];
}

export interface PolicyAuthorArtifactRequestV0 {
  readonly schema: typeof POLICY_AUTHOR_REQUEST_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly step: "author-artifact";
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly receipt_history_summary_hash: ContentHashV0;
  readonly history_query: PolicyAuthorHistoryQueryV0;
  readonly selected_receipts: readonly ReceiptV0[];
}

export type PolicyAuthorRequestPayloadV0 =
  | PolicyAuthorHistoryQueryRequestV0
  | PolicyAuthorArtifactRequestV0;

export interface AuthorPolicyArtifactV0Input {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly receipt_history: readonly ReceiptV0[];
  readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly policy_artifact_namespace?: string;
}

export type PolicyArtifactValidationV0 =
  | {
      readonly ok: true;
      readonly artifact: AuthoredPolicyArtifactV0;
      readonly bytes: string;
      readonly content_hash: ContentHashV0;
      readonly kernel_validation: Extract<KernelPolicyArtifactValidation, { ok: true }>;
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly live_observable_refs: readonly string[];
      readonly kernel_validation?: KernelPolicyArtifactValidation;
    };

export interface DerivePolicyDriftFactsV0Input {
  readonly receipts: readonly ReceiptV0[];
  readonly as_of?: string;
  readonly responsibility_id?: string;
  readonly contract_revision?: ContentHashV0;
}

export interface PolicyDriftFactsV0 {
  readonly schema: typeof POLICY_DRIFT_FACTS_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly as_of: string | null;
  readonly facts: KernelFacts;
  readonly supported_fact_ids: readonly string[];
  readonly unsupported_fact_ids: readonly string[];
  readonly evidence_receipt_hashes: readonly ContentHashV0[];
}

export interface EvaluatePolicyDriftV0Input {
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly receipts: readonly ReceiptV0[];
  readonly as_of?: string;
}

export interface EvaluatePolicyDriftV0Options {
  readonly as_of?: string;
}

export interface PolicyDriftEvaluationV0 {
  readonly schema: typeof POLICY_DRIFT_EVALUATION_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly outcome: "not-tripped" | "tripped" | "indeterminate";
  readonly as_of: string | null;
  readonly policy_artifact_content_hash: ContentHashV0;
  readonly policy_artifact_revision: string;
  readonly facts: KernelFacts;
  readonly evidence_receipt_hashes: readonly ContentHashV0[];
  readonly predicate: PredicateEvaluation;
  readonly missing_fact_ids: readonly string[];
  readonly unsupported_fact_ids: readonly string[];
}

export type PolicyRecompileDecisionOutcomeV0 =
  | "no-recompile-needed"
  | "recompile-requested"
  | "recompile-delayed"
  | "needs-judgment";

export type PolicyRecompileRequestSourceV0 =
  | "policy-drift"
  | "backstop:max_policy_age"
  | "backstop:max_policy_age_no_anchor"
  | "backstop:max_calibration_divergence";

export interface PlanPolicyRecompileV0Input {
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly receipts: readonly ReceiptV0[];
  readonly as_of: string;
  readonly last_policy_revalidated_at: string;
  readonly last_recompile_at: string;
  readonly observed_calibration_divergence_multiplier?: number;
  readonly calibration_evidence_as_of?: string;
  readonly max_calibration_evidence_age_ms?: number;
  readonly policy_warmup_judged_activations?: number;
  readonly warmup_judged_activations?: number;
  readonly last_unforced_deep_at?: string;
}

export interface PolicyRecompileDecisionV0 {
  readonly schema: typeof POLICY_RECOMPILE_DECISION_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly outcome: PolicyRecompileDecisionOutcomeV0;
  readonly as_of: string;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_content_hash: ContentHashV0;
  readonly policy_artifact_revision: string;
  readonly requested_by: readonly PolicyRecompileRequestSourceV0[];
  readonly reasons: readonly string[];
  readonly drift: PolicyDriftEvaluationV0;
  readonly evidence_receipt_hashes: readonly ContentHashV0[];
  readonly backstops: KernelBackstopEvaluation;
  readonly delayed_by?: "min_recompile_interval";
  readonly retry_after_ms?: number;
}

export type PolicyRollbackDecisionOutcomeV0 = RollbackOutcome;

export interface PlanPolicyRollbackV0Input {
  readonly fresh_policy_revision: string;
  readonly fresh_policy_judged_activations_before_trip: number;
  readonly last_known_good_revision?: string;
  readonly last_known_good_judged_activations_before_trip?: number;
}

export interface PolicyRollbackDecisionV0 {
  readonly schema: typeof POLICY_ROLLBACK_DECISION_SCHEMA;
  readonly v: typeof POLICY_ARTIFACT_VERSION;
  readonly fresh_policy_revision: string;
  readonly last_known_good_revision?: string;
  readonly fresh_policy_judged_activations_before_trip: JudgedActivations;
  readonly last_known_good_judged_activations_before_trip?: JudgedActivations;
  readonly outcome: PolicyRollbackDecisionOutcomeV0;
  readonly reason: string;
  readonly target_policy_revision?: string;
}

export interface ExecutePolicyRecompileV0Input {
  readonly decision: PolicyRecompileDecisionV0;
  readonly author_input?: AuthorPolicyArtifactV0Input;
}

export type PolicyRecompileExecutionV0 =
  | {
      readonly schema: typeof POLICY_RECOMPILE_EXECUTION_SCHEMA;
      readonly v: typeof POLICY_ARTIFACT_VERSION;
      readonly outcome: "recompile-authored";
      readonly decision: PolicyRecompileDecisionV0;
      readonly registry: ReactorRegistrySnapshotV0;
    }
  | {
      readonly schema: typeof POLICY_RECOMPILE_EXECUTION_SCHEMA;
      readonly v: typeof POLICY_ARTIFACT_VERSION;
      readonly outcome: "not-executed";
      readonly decision: PolicyRecompileDecisionV0;
      readonly reason: string;
    };

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const LIVE_OBSERVABLE_SOURCES = new Set<PolicyLiveObservableSourceV0>([
  "connector",
  "receipt-log",
  "kernel-backstop",
  "cost-ledger",
  "human-label-stream",
]);
const POLICY_DRIFT_FACT_ID_SET = new Set<string>(POLICY_DRIFT_FACT_IDS_V0);
const ESCALATION_CONFIRMED_TAGS = new Set([
  "escalation:confirmed",
  "escalation:true-positive",
  "escalation:true_positive",
  "escalation-confirmed",
  "escalation-needed",
  "escalation:needed",
]);
const ESCALATION_REFUTED_TAGS = new Set([
  "escalation:refuted",
  "escalation:false-positive",
  "escalation:false_positive",
  "escalation-refuted",
  "escalation-unneeded",
  "escalation:unneeded",
]);
const DEEP_SHALLOW_CONTRADICTION_TAGS = new Set([
  "backstop-divergence",
  "deep-shallow-contradiction",
  "kernel:deep-shallow-contradiction",
]);

export function authorPolicyArtifactV0(
  input: AuthorPolicyArtifactV0Input,
): ReactorRegistrySnapshotV0 {
  validateAuthorInput(input);

  const receiptHistory = assertReceiptHistory(input.receipt_history);
  const receiptHistorySummary = receiptHistory.map((receipt) =>
    summarizeReceiptForPolicyAuthor(receipt),
  );
  const receiptHistorySummaryHash = hashCanonicalReceiptV0(
    canonicalizeForReceiptV0(receiptHistorySummary),
  );
  const historyRequest: PolicyAuthorHistoryQueryRequestV0 = {
    schema: POLICY_AUTHOR_REQUEST_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    step: "history-query",
    responsibility_id: input.responsibility_id,
    contract_revision: input.contract_revision,
    contract_summary: input.contract_summary,
    no_anchor: input.no_anchor,
    live_observables: canonicalLiveObservables(input.live_observables),
    receipt_history_summary: receiptHistorySummary,
  };

  const historyResponse = input.agentSdk.launch({
    kind: "policy-author",
    payload: historyRequest,
  });
  const historyQuery = readHistoryQueryResponse(historyResponse.payload);
  assertSelectedReceiptsExist(historyQuery, receiptHistory);

  const selectedReceipts = selectReceipts(receiptHistory, historyQuery);
  const artifactRequest: PolicyAuthorArtifactRequestV0 = {
    schema: POLICY_AUTHOR_REQUEST_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    step: "author-artifact",
    responsibility_id: input.responsibility_id,
    contract_revision: input.contract_revision,
    contract_summary: input.contract_summary,
    no_anchor: input.no_anchor,
    live_observables: canonicalLiveObservables(input.live_observables),
    receipt_history_summary_hash: receiptHistorySummaryHash,
    history_query: historyQuery,
    selected_receipts: selectedReceipts,
  };

  const artifactResponse = input.agentSdk.launch({
    kind: "policy-author",
    payload: artifactRequest,
  });
  const authoredArtifact = normalizeAuthoredPolicyArtifactV0(
    readAuthoredArtifactResponse(artifactResponse.payload),
    {
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      no_anchor: input.no_anchor,
      live_observables: input.live_observables,
      receipt_history_summary_hash: receiptHistorySummaryHash,
      history_query: historyQuery,
    },
  );
  const validation = validatePolicyArtifactV0(authoredArtifact);

  if (!validation.ok) {
    throw new Error(
      `policy artifact validation failed: ${validation.errors.join("; ")}`,
    );
  }

  const namespace =
    input.policy_artifact_namespace ?? validation.artifact.registry_id;
  const validationState = {
    status: "validated" as const,
    validator_id: POLICY_ARTIFACT_VALIDATOR_ID,
  };

  return {
    contract_revision: input.contract_revision,
    policy_artifact_id: validation.artifact.registry_id,
    policy_artifact_identity: validation.artifact.registry_id,
    policy_artifact_namespace: namespace,
    policy_artifact_revision: validation.artifact.policy_revision,
    policy_artifact_validation_state: validationState,
    validation_state: validationState,
    policy_artifact_bytes: validation.bytes,
    policy_artifact_content_hash: validation.content_hash,
    transitive_freshness_function:
      validation.artifact.transitive_freshness_function,
  };
}

export function validatePolicyArtifactV0(
  value: unknown,
): PolicyArtifactValidationV0 {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ["policy artifact must be an object"],
      live_observable_refs: [],
    };
  }

  validateKnownKeys(
    value,
    "policy_artifact",
    [
      "schema",
      "v",
      "responsibility_id",
      "registry_id",
      "policy_revision",
      "no_anchor",
      "live_observables",
      "cadence",
      "hysteresis",
      "thresholds",
      "transitive_freshness_function",
      "falsification_predicate",
      "backstop_divergence_predicate",
      "provenance",
    ],
    errors,
  );
  expectLiteral(
    value["schema"],
    POLICY_ARTIFACT_SCHEMA,
    "policy_artifact.schema",
    errors,
  );
  expectLiteral(
    value["v"],
    POLICY_ARTIFACT_VERSION,
    "policy_artifact.v",
    errors,
  );
  const responsibilityId = readNonEmptyString(
    value["responsibility_id"],
    "policy_artifact.responsibility_id",
    errors,
  );
  const registryId = readNonEmptyString(
    value["registry_id"],
    "policy_artifact.registry_id",
    errors,
  );
  const policyRevision = readNonEmptyString(
    value["policy_revision"],
    "policy_artifact.policy_revision",
    errors,
  );
  const noAnchor = readBoolean(
    value["no_anchor"],
    "policy_artifact.no_anchor",
    errors,
  );
  const liveObservables = readLiveObservables(
    value["live_observables"],
    "policy_artifact.live_observables",
    errors,
  );
  const cadence = readCadence(value["cadence"], noAnchor, errors);
  const hysteresis = readHysteresis(value["hysteresis"], errors);
  const thresholds = readThresholds(value["thresholds"], errors);
  const transitiveFreshnessFunction = readTransitiveFreshnessFunction(
    value["transitive_freshness_function"],
    "policy_artifact.transitive_freshness_function",
    errors,
  );
  const falsificationPredicate = readPredicate(
    value["falsification_predicate"],
    "policy_artifact.falsification_predicate",
    errors,
  );
  const backstopDivergencePredicate =
    value["backstop_divergence_predicate"] === undefined
      ? undefined
      : readPredicate(
          value["backstop_divergence_predicate"],
          "policy_artifact.backstop_divergence_predicate",
          errors,
        );
  const provenance = readProvenance(value["provenance"], errors);
  if (
    provenance !== undefined &&
    provenance.explored_receipt_hashes.join("\0") !==
      provenance.history_query.selected_receipt_hashes.join("\0")
  ) {
    errors.push(
      "policy_artifact.provenance.explored_receipt_hashes must match history_query.selected_receipt_hashes",
    );
  }

  let kernelValidation: KernelPolicyArtifactValidation | undefined;
  if (
    noAnchor !== undefined &&
    liveObservables.length > 0 &&
    falsificationPredicate !== undefined
  ) {
    const liveObservableIds = liveObservables.map((observable) => observable.id);
    rejectOffLivePredicateFacts(
      falsificationPredicate,
      "policy_artifact.falsification_predicate",
      liveObservableIds,
      errors,
    );

    if (backstopDivergencePredicate !== undefined) {
      rejectOffLivePredicateFacts(
        backstopDivergencePredicate,
        "policy_artifact.backstop_divergence_predicate",
        liveObservableIds,
        errors,
      );
    }

    kernelValidation = validateKernelPolicyArtifact({
      no_anchor: noAnchor,
      falsification_predicate: falsificationPredicate,
      live_observables: liveObservableIds,
      ...(backstopDivergencePredicate === undefined
        ? {}
        : { backstop_divergence_predicate: backstopDivergencePredicate }),
    });

    if (!kernelValidation.ok) {
      errors.push(
        ...kernelValidation.errors.map((error) => `kernel validation: ${error}`),
      );
    }
  }

  if (
    errors.length > 0 ||
    responsibilityId === undefined ||
    registryId === undefined ||
    policyRevision === undefined ||
    noAnchor === undefined ||
    cadence === undefined ||
    hysteresis === undefined ||
    thresholds === undefined ||
    transitiveFreshnessFunction === undefined ||
    falsificationPredicate === undefined ||
    provenance === undefined ||
    kernelValidation === undefined ||
    !kernelValidation.ok
  ) {
    return {
      ok: false,
      errors,
      live_observable_refs: kernelValidation?.live_observable_refs ?? [],
      ...(kernelValidation === undefined ? {} : { kernel_validation: kernelValidation }),
    };
  }

  const artifact: AuthoredPolicyArtifactV0 = {
    schema: POLICY_ARTIFACT_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    responsibility_id: responsibilityId,
    registry_id: registryId,
    policy_revision: policyRevision,
    no_anchor: noAnchor,
    live_observables: liveObservables,
    cadence,
    hysteresis,
    thresholds,
    transitive_freshness_function: transitiveFreshnessFunction,
    falsification_predicate: falsificationPredicate,
    ...(backstopDivergencePredicate === undefined
      ? {}
      : { backstop_divergence_predicate: backstopDivergencePredicate }),
    provenance,
  };
  const bytes = canonicalizePolicyArtifactV0(artifact);

  return {
    ok: true,
    artifact,
    bytes,
    content_hash: hashCanonicalReceiptV0(bytes),
    kernel_validation: kernelValidation,
  };
}

export function canonicalizePolicyArtifactV0(
  artifact: AuthoredPolicyArtifactV0,
): string {
  return canonicalizeForReceiptV0(artifact);
}

export function normalizePolicyTransitiveFreshnessFunctionV0(
  value: unknown,
  path = "transitive_freshness_function",
): PolicyTransitiveFreshnessFunctionV0 {
  const errors: string[] = [];
  const fn = readTransitiveFreshnessFunction(value, path, errors);

  if (fn === undefined || errors.length > 0) {
    throw new Error(`${path} is malformed: ${errors.join("; ")}`);
  }

  return fn;
}

export function derivePolicyDriftFactsV0(
  receipts: readonly ReceiptV0[],
): PolicyDriftFactsV0;
export function derivePolicyDriftFactsV0(
  input: DerivePolicyDriftFactsV0Input,
): PolicyDriftFactsV0;
export function derivePolicyDriftFactsV0(
  inputOrReceipts: DerivePolicyDriftFactsV0Input | readonly ReceiptV0[],
): PolicyDriftFactsV0 {
  const input = normalizePolicyDriftFactInput(inputOrReceipts);
  const receipts = assertPolicyDriftReceiptLog(input.receipts);
  const scopedReceipts = sortReceiptsForPolicyDrift(
    receipts.filter((receipt) => receiptBelongsToPolicyDriftScope(receipt, input)),
  );
  const asOf = resolvePolicyDriftAsOf(scopedReceipts, input.as_of);
  const facts: Record<string, number> = {};
  const unsupportedFactIds = new Set<string>(POLICY_DRIFT_FACT_IDS_V0);

  if (asOf !== null) {
    const asOfMs = parseReplayableInstantMs(asOf, "policy drift as_of");
    const freshTokensPerDay = deriveFreshTokensPerMaintainedDay(
      scopedReceipts,
      asOfMs,
    );
    if (freshTokensPerDay !== undefined) {
      facts["cost.fresh_tokens_per_maintained_day"] = freshTokensPerDay;
      unsupportedFactIds.delete("cost.fresh_tokens_per_maintained_day");
    }

    const escalationPrecision = deriveEscalationPrecision7d(scopedReceipts, asOfMs);
    if (escalationPrecision !== undefined) {
      facts["receipt.escalation_precision_7d"] = escalationPrecision;
      unsupportedFactIds.delete("receipt.escalation_precision_7d");
    }

    const contradictionCount = deriveDeepShallowContradictionCount7d(
      scopedReceipts,
      asOfMs,
    );
    if (contradictionCount !== undefined) {
      facts["kernel.deep_shallow_contradiction_count_7d"] = contradictionCount;
      unsupportedFactIds.delete("kernel.deep_shallow_contradiction_count_7d");
    }
  }

  const supportedFactIds = Object.keys(facts).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    schema: POLICY_DRIFT_FACTS_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    as_of: asOf,
    facts: Object.freeze({ ...facts }),
    supported_fact_ids: Object.freeze(supportedFactIds),
    unsupported_fact_ids: Object.freeze(
      [...unsupportedFactIds].sort((left, right) => left.localeCompare(right)),
    ),
    evidence_receipt_hashes: Object.freeze(
      evidenceReceiptHashesForPolicyDrift(scopedReceipts, asOf),
    ),
  };
}

export function evaluatePolicyDriftV0(
  input: EvaluatePolicyDriftV0Input,
): PolicyDriftEvaluationV0;
export function evaluatePolicyDriftV0(
  artifact: AuthoredPolicyArtifactV0,
  receipts: readonly ReceiptV0[],
  options?: EvaluatePolicyDriftV0Options,
): PolicyDriftEvaluationV0;
export function evaluatePolicyDriftV0(
  inputOrArtifact: EvaluatePolicyDriftV0Input | AuthoredPolicyArtifactV0,
  receipts?: readonly ReceiptV0[],
  options: EvaluatePolicyDriftV0Options = {},
): PolicyDriftEvaluationV0 {
  const input = normalizePolicyDriftEvaluationInput(
    inputOrArtifact,
    receipts,
    options,
  );
  const validation = validatePolicyArtifactV0(input.artifact);

  if (!validation.ok) {
    throw new Error(
      `policy drift evaluation requires a validated policy artifact: ${validation.errors.join("; ")}`,
    );
  }

  const artifact = validation.artifact;
  const derivation = derivePolicyDriftFactsV0({
    receipts: input.receipts,
    responsibility_id: artifact.responsibility_id,
    contract_revision: artifact.provenance.contract_revision,
    ...(input.as_of === undefined ? {} : { as_of: input.as_of }),
  });
  const predicateFactIds = collectPredicateFacts(artifact.falsification_predicate);
  const missingFactIds = predicateFactIds.filter(
    (fact) => !Object.prototype.hasOwnProperty.call(derivation.facts, fact),
  );

  if (missingFactIds.length > 0) {
    const unsupportedFactIds = missingFactIds.filter(
      (fact) =>
        !POLICY_DRIFT_FACT_ID_SET.has(fact) ||
        derivation.unsupported_fact_ids.includes(fact),
    );

    return {
      schema: POLICY_DRIFT_EVALUATION_SCHEMA,
      v: POLICY_ARTIFACT_VERSION,
      outcome: "indeterminate",
      as_of: derivation.as_of,
      policy_artifact_content_hash: validation.content_hash,
      policy_artifact_revision: artifact.policy_revision,
      facts: derivation.facts,
      evidence_receipt_hashes: derivation.evidence_receipt_hashes,
      predicate: {
        outcome: "indeterminate",
        reason: `unsupported or missing policy drift fact(s): ${missingFactIds.join(", ")}`,
      },
      missing_fact_ids: Object.freeze([...missingFactIds]),
      unsupported_fact_ids: Object.freeze(
        unsupportedFactIds.sort((left, right) => left.localeCompare(right)),
      ),
    };
  }

  const predicate = evaluatePredicate(
    artifact.falsification_predicate,
    derivation.facts,
  );

  return {
    schema: POLICY_DRIFT_EVALUATION_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    outcome: predicate.outcome,
    as_of: derivation.as_of,
    policy_artifact_content_hash: validation.content_hash,
    policy_artifact_revision: artifact.policy_revision,
    facts: derivation.facts,
    evidence_receipt_hashes: derivation.evidence_receipt_hashes,
    predicate,
    missing_fact_ids: Object.freeze([]),
    unsupported_fact_ids: Object.freeze([]),
  };
}

export function planPolicyRecompileV0(
  input: PlanPolicyRecompileV0Input,
): PolicyRecompileDecisionV0 {
  validatePolicyRecompileInput(input);

  const validation = validatePolicyArtifactV0(input.artifact);
  if (!validation.ok) {
    throw new Error(
      `policy recompile planning requires a validated policy artifact: ${validation.errors.join("; ")}`,
    );
  }

  const artifact = validation.artifact;
  const drift = evaluatePolicyDriftV0({
    artifact,
    receipts: input.receipts,
    as_of: input.as_of,
  });
  const preliminaryRecompileRequested = drift.outcome === "tripped";
  let backstops = evaluatePolicyRecompileBackstops(
    input,
    artifact,
    validation,
    preliminaryRecompileRequested,
  );
  let requestedBy = collectPolicyRecompileRequestSources(
    drift,
    backstops,
  );

  if (requestedBy.length > 0 && !preliminaryRecompileRequested) {
    backstops = evaluatePolicyRecompileBackstops(
      input,
      artifact,
      validation,
      true,
    );
    requestedBy = collectPolicyRecompileRequestSources(drift, backstops);
  }

  const base = {
    schema: POLICY_RECOMPILE_DECISION_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    as_of: input.as_of,
    responsibility_id: artifact.responsibility_id,
    contract_revision: artifact.provenance.contract_revision,
    policy_artifact_content_hash: validation.content_hash,
    policy_artifact_revision: artifact.policy_revision,
    requested_by: Object.freeze([...requestedBy]),
    drift,
    evidence_receipt_hashes: drift.evidence_receipt_hashes,
    backstops,
  } as const;

  if (drift.outcome === "indeterminate") {
    return {
      ...base,
      outcome: "needs-judgment",
      reasons: Object.freeze([
        drift.predicate.reason ??
          "policy drift predicate was indeterminate against receipt evidence",
      ]),
    };
  }

  if (requestedBy.length === 0) {
    return {
      ...base,
      outcome: "no-recompile-needed",
      reasons: Object.freeze(["policy drift and recompile backstops did not trip"]),
    };
  }

  if (hasMinRecompileDelay(backstops)) {
    return {
      ...base,
      outcome: "recompile-delayed",
      reasons: Object.freeze([
        "recompile request is held by the fixed min_recompile_interval backstop",
      ]),
      delayed_by: "min_recompile_interval",
      retry_after_ms: remainingMinRecompileIntervalMs(input),
    };
  }

  return {
    ...base,
    outcome: "recompile-requested",
    reasons: Object.freeze(["policy drift or a fixed backstop requested recompile"]),
  };
}

export function executePolicyRecompileV0(
  input: ExecutePolicyRecompileV0Input,
): PolicyRecompileExecutionV0 {
  if (input.decision.outcome !== "recompile-requested") {
    return {
      schema: POLICY_RECOMPILE_EXECUTION_SCHEMA,
      v: POLICY_ARTIFACT_VERSION,
      outcome: "not-executed",
      decision: input.decision,
      reason: `policy author is not allowed for ${input.decision.outcome}`,
    };
  }

  if (input.author_input === undefined) {
    throw new Error("policy recompile execution requires author_input");
  }

  return {
    schema: POLICY_RECOMPILE_EXECUTION_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    outcome: "recompile-authored",
    decision: input.decision,
    registry: authorPolicyArtifactV0(input.author_input),
  };
}

export function planPolicyRollbackV0(
  input: PlanPolicyRollbackV0Input,
): PolicyRollbackDecisionV0 {
  validatePolicyRollbackInput(input);

  const freshJudgedActivations = judgedActivations(
    input.fresh_policy_judged_activations_before_trip,
    "fresh_policy_judged_activations_before_trip",
  );
  const lastKnownGoodJudgedActivations =
    input.last_known_good_judged_activations_before_trip === undefined
      ? undefined
      : judgedActivations(
          input.last_known_good_judged_activations_before_trip,
          "last_known_good_judged_activations_before_trip",
        );
  const comparison = compareRollback({
    fresh_policy_revision: input.fresh_policy_revision,
    fresh_policy_judged_activations_before_trip: freshJudgedActivations,
    ...(input.last_known_good_revision === undefined
      ? {}
      : { last_known_good_revision: input.last_known_good_revision }),
    ...(lastKnownGoodJudgedActivations === undefined
      ? {}
      : {
          last_known_good_judged_activations_before_trip:
            lastKnownGoodJudgedActivations,
        }),
  });

  return {
    schema: POLICY_ROLLBACK_DECISION_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    fresh_policy_revision: input.fresh_policy_revision,
    ...(input.last_known_good_revision === undefined
      ? {}
      : { last_known_good_revision: input.last_known_good_revision }),
    fresh_policy_judged_activations_before_trip: freshJudgedActivations,
    ...(lastKnownGoodJudgedActivations === undefined
      ? {}
      : {
          last_known_good_judged_activations_before_trip:
            lastKnownGoodJudgedActivations,
        }),
    outcome: comparison.outcome,
    reason: comparison.reason,
    ...(comparison.target_policy_revision === undefined
      ? {}
      : { target_policy_revision: comparison.target_policy_revision }),
  };
}

function validatePolicyRollbackInput(input: PlanPolicyRollbackV0Input): void {
  if (!isRecord(input)) {
    throw new Error("policy rollback input must be an object");
  }

  const errors: string[] = [];
  readNonEmptyString(
    input.fresh_policy_revision,
    "fresh_policy_revision",
    errors,
  );
  if (input.last_known_good_revision !== undefined) {
    readNonEmptyString(
      input.last_known_good_revision,
      "last_known_good_revision",
      errors,
    );
  }

  if (errors.length > 0) {
    throw new Error(`policy rollback input is malformed: ${errors.join("; ")}`);
  }
}

function validatePolicyRecompileInput(input: PlanPolicyRecompileV0Input): void {
  const asOfMs = parseReplayableInstantMs(input.as_of, "policy recompile as_of");
  const lastPolicyRevalidatedMs = parseReplayableInstantMs(
    input.last_policy_revalidated_at,
    "policy recompile last_policy_revalidated_at",
  );
  const lastRecompileMs = parseReplayableInstantMs(
    input.last_recompile_at,
    "policy recompile last_recompile_at",
  );

  if (lastPolicyRevalidatedMs > asOfMs) {
    throw new Error("policy recompile last_policy_revalidated_at must not be after as_of");
  }
  if (lastRecompileMs > asOfMs) {
    throw new Error("policy recompile last_recompile_at must not be after as_of");
  }
  if (input.last_unforced_deep_at !== undefined) {
    const lastUnforcedDeepMs = parseReplayableInstantMs(
      input.last_unforced_deep_at,
      "policy recompile last_unforced_deep_at",
    );
    if (lastUnforcedDeepMs > asOfMs) {
      throw new Error("policy recompile last_unforced_deep_at must not be after as_of");
    }
  }
  if (input.calibration_evidence_as_of !== undefined) {
    const calibrationEvidenceMs = parseReplayableInstantMs(
      input.calibration_evidence_as_of,
      "policy recompile calibration_evidence_as_of",
    );
    if (calibrationEvidenceMs > asOfMs) {
      throw new Error(
        "policy recompile calibration_evidence_as_of must not be after as_of",
      );
    }
  }
  if (
    input.observed_calibration_divergence_multiplier !== undefined &&
    (!Number.isFinite(input.observed_calibration_divergence_multiplier) ||
      input.observed_calibration_divergence_multiplier <= 0)
  ) {
    throw new Error(
      "policy recompile observed_calibration_divergence_multiplier must be positive",
    );
  }
  if (
    input.max_calibration_evidence_age_ms !== undefined &&
    (!Number.isSafeInteger(input.max_calibration_evidence_age_ms) ||
      input.max_calibration_evidence_age_ms <= 0)
  ) {
    throw new Error(
      "policy recompile max_calibration_evidence_age_ms must be a positive safe integer",
    );
  }
}

function evaluatePolicyRecompileBackstops(
  input: PlanPolicyRecompileV0Input,
  artifact: AuthoredPolicyArtifactV0,
  validation: Extract<PolicyArtifactValidationV0, { ok: true }>,
  recompileRequested: boolean,
): KernelBackstopEvaluation {
  return evaluateBackstops({
    token: validation.kernel_validation.token,
    as_of: input.as_of,
    last_policy_revalidated_at: input.last_policy_revalidated_at,
    last_recompile_at: input.last_recompile_at,
    recompile_requested: recompileRequested,
    ...(input.observed_calibration_divergence_multiplier === undefined
      ? {}
      : {
          observed_calibration_divergence_multiplier:
            input.observed_calibration_divergence_multiplier,
        }),
    ...(input.calibration_evidence_as_of === undefined
      ? {}
      : { calibration_evidence_as_of: input.calibration_evidence_as_of }),
    ...(input.max_calibration_evidence_age_ms === undefined
      ? {}
      : { max_calibration_evidence_age_ms: input.max_calibration_evidence_age_ms }),
    warmup_length: judgedActivations(
      input.warmup_judged_activations ??
        artifact.hysteresis.warmup_judged_activations,
      "warmup_judged_activations",
    ),
    policy_warmup_judged_activations: judgedActivations(
      input.policy_warmup_judged_activations ??
        artifact.hysteresis.warmup_judged_activations,
      "policy_warmup_judged_activations",
    ),
    ...(input.last_unforced_deep_at === undefined
      ? {}
      : { last_unforced_deep_at: input.last_unforced_deep_at }),
  });
}

function collectPolicyRecompileRequestSources(
  drift: PolicyDriftEvaluationV0,
  backstops: KernelBackstopEvaluation,
): readonly PolicyRecompileRequestSourceV0[] {
  const sources: PolicyRecompileRequestSourceV0[] = [];

  if (drift.outcome === "tripped") {
    sources.push("policy-drift");
  }

  for (const outcome of backstops.outcomes) {
    const source = policyRecompileSourceForBackstop(outcome.backstop);
    if (
      source !== undefined &&
      (outcome.action === "force-policy-recompile" ||
        outcome.action === "force-policy-revalidation")
    ) {
      sources.push(source);
    }
  }

  return Object.freeze(
    [...new Set(sources)].sort((left, right) => left.localeCompare(right)),
  );
}

function policyRecompileSourceForBackstop(
  backstop: KernelBackstopName,
): PolicyRecompileRequestSourceV0 | undefined {
  switch (backstop) {
    case "max_policy_age":
      return "backstop:max_policy_age";
    case "max_policy_age_no_anchor":
      return "backstop:max_policy_age_no_anchor";
    case "max_calibration_divergence":
      return "backstop:max_calibration_divergence";
    case "min_recompile_interval":
    case "max_calibration_evidence_age":
    case "warmup_length":
    case "max_unforced_deep_interval":
      return undefined;
  }
}

function hasMinRecompileDelay(backstops: KernelBackstopEvaluation): boolean {
  return backstops.outcomes.some(
    (outcome) => outcome.action === "delay-recompile-for-min-interval",
  );
}

function remainingMinRecompileIntervalMs(
  input: PlanPolicyRecompileV0Input,
): number {
  const asOfMs = parseReplayableInstantMs(input.as_of, "policy recompile as_of");
  const lastRecompileMs = parseReplayableInstantMs(
    input.last_recompile_at,
    "policy recompile last_recompile_at",
  );
  const elapsedMs = asOfMs - lastRecompileMs;

  return Math.max(0, KERNEL_BACKSTOPS.minRecompileIntervalMs - elapsedMs);
}

function validateAuthorInput(input: AuthorPolicyArtifactV0Input): void {
  const errors: string[] = [];

  readNonEmptyString(input.responsibility_id, "responsibility_id", errors);
  if (!isContentHash(input.contract_revision)) {
    errors.push("contract_revision must be a sha256 content address");
  }
  readNonEmptyString(input.contract_summary, "contract_summary", errors);
  if (typeof input.no_anchor !== "boolean") {
    errors.push("no_anchor must be boolean");
  }
  readLiveObservables(input.live_observables, "live_observables", errors);
  if (typeof input.agentSdk?.launch !== "function") {
    errors.push("agentSdk.launch adapter is required");
  }
  if (!Array.isArray(input.receipt_history)) {
    errors.push("receipt_history must be an array");
  }
  if (
    input.policy_artifact_namespace !== undefined &&
    input.policy_artifact_namespace.length === 0
  ) {
    errors.push("policy_artifact_namespace must be non-empty when supplied");
  }

  if (errors.length > 0) {
    throw new Error(`policy author input is malformed: ${errors.join("; ")}`);
  }
}

function assertReceiptHistory(receipts: readonly ReceiptV0[]): readonly ReceiptV0[] {
  return assertVerifiedReceiptLog(
    receipts,
    "policy author receipt history",
    "receipt_history",
  );
}

function assertPolicyDriftReceiptLog(
  receipts: readonly ReceiptV0[],
): readonly ReceiptV0[] {
  return assertVerifiedReceiptLog(receipts, "policy drift receipt log", "receipts");
}

function assertVerifiedReceiptLog(
  receipts: readonly ReceiptV0[],
  context: string,
  path: string,
): readonly ReceiptV0[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  receipts.forEach((receipt, index) => {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      errors.push(
        `${path}[${index}] is invalid: ${verification.errors.join("; ")}`,
      );
      return;
    }

    if (seen.has(receipt.content_hash)) {
      errors.push(`${path}[${index}].content_hash is duplicated`);
    }
    seen.add(receipt.content_hash);
  });

  if (errors.length > 0) {
    throw new Error(`${context} is malformed: ${errors.join("; ")}`);
  }

  return Object.freeze([...receipts]);
}

interface PolicyDriftReceiptEntry {
  readonly receipt: ReceiptV0;
  readonly as_of_ms: number;
}

function normalizePolicyDriftFactInput(
  inputOrReceipts: DerivePolicyDriftFactsV0Input | readonly ReceiptV0[],
): DerivePolicyDriftFactsV0Input {
  if (Array.isArray(inputOrReceipts)) {
    return { receipts: inputOrReceipts };
  }

  if (!isRecord(inputOrReceipts) || !Array.isArray(inputOrReceipts["receipts"])) {
    throw new Error("policy drift fact input must include receipts");
  }

  const input = inputOrReceipts as DerivePolicyDriftFactsV0Input;
  if (input.as_of !== undefined) {
    parseReplayableInstantMs(input.as_of, "policy drift as_of");
  }
  if (
    input.responsibility_id !== undefined &&
    input.responsibility_id.length === 0
  ) {
    throw new Error("policy drift responsibility_id must be non-empty when supplied");
  }
  if (
    input.contract_revision !== undefined &&
    !isContentHash(input.contract_revision)
  ) {
    throw new Error("policy drift contract_revision must be a sha256 content address");
  }

  return input;
}

function normalizePolicyDriftEvaluationInput(
  inputOrArtifact: EvaluatePolicyDriftV0Input | AuthoredPolicyArtifactV0,
  receipts: readonly ReceiptV0[] | undefined,
  options: EvaluatePolicyDriftV0Options,
): EvaluatePolicyDriftV0Input {
  if (receipts !== undefined) {
    return {
      artifact: inputOrArtifact as AuthoredPolicyArtifactV0,
      receipts,
      ...(options.as_of === undefined ? {} : { as_of: options.as_of }),
    };
  }

  if (
    !isRecord(inputOrArtifact) ||
    !isRecord(inputOrArtifact["artifact"]) ||
    !Array.isArray(inputOrArtifact["receipts"])
  ) {
    throw new Error("policy drift evaluation input must include artifact and receipts");
  }

  const input = inputOrArtifact as EvaluatePolicyDriftV0Input;
  if (input.as_of !== undefined) {
    parseReplayableInstantMs(input.as_of, "policy drift as_of");
  }

  return input;
}

function receiptBelongsToPolicyDriftScope(
  receipt: ReceiptV0,
  input: DerivePolicyDriftFactsV0Input,
): boolean {
  if (
    input.responsibility_id !== undefined &&
    receipt.core.responsibility_id !== input.responsibility_id
  ) {
    return false;
  }
  if (
    input.contract_revision !== undefined &&
    receipt.core.contract_revision !== input.contract_revision
  ) {
    return false;
  }

  return true;
}

function sortReceiptsForPolicyDrift(
  receipts: readonly ReceiptV0[],
): readonly PolicyDriftReceiptEntry[] {
  return Object.freeze(
    receipts
      .map((receipt) => ({
        receipt,
        as_of_ms: parseReplayableInstantMs(
          receipt.core.as_of,
          `receipt ${receipt.content_hash} core.as_of`,
        ),
      }))
      .sort((left, right) => {
        const byTime = left.as_of_ms - right.as_of_ms;
        return byTime === 0
          ? left.receipt.content_hash.localeCompare(right.receipt.content_hash)
          : byTime;
      }),
  );
}

function resolvePolicyDriftAsOf(
  receipts: readonly PolicyDriftReceiptEntry[],
  suppliedAsOf: string | undefined,
): string | null {
  if (suppliedAsOf !== undefined) {
    parseReplayableInstantMs(suppliedAsOf, "policy drift as_of");
    return suppliedAsOf;
  }

  return receipts.at(-1)?.receipt.core.as_of ?? null;
}

function deriveFreshTokensPerMaintainedDay(
  receipts: readonly PolicyDriftReceiptEntry[],
  asOfMs: number,
): number | undefined {
  const eligible = receipts.filter((entry) => entry.as_of_ms <= asOfMs);
  const first = eligible[0];
  if (first === undefined) {
    return undefined;
  }

  const elapsedMs = asOfMs - first.as_of_ms;
  if (elapsedMs <= 0) {
    return undefined;
  }

  const freshTokens = eligible.reduce(
    (sum, entry) => sum + entry.receipt.cost.tokens.fresh,
    0,
  );

  return freshTokens / (elapsedMs / KERNEL_DAY_MS);
}

function deriveEscalationPrecision7d(
  receipts: readonly PolicyDriftReceiptEntry[],
  asOfMs: number,
): number | undefined {
  let confirmed = 0;
  let refuted = 0;

  for (const entry of policyDriftSevenDayWindow(receipts, asOfMs)) {
    const label = escalationPrecisionLabel(entry.receipt);
    if (label === "confirmed") {
      confirmed += 1;
    } else if (label === "refuted") {
      refuted += 1;
    }
  }

  const labeledEscalations = confirmed + refuted;
  return labeledEscalations === 0 ? undefined : confirmed / labeledEscalations;
}

function deriveDeepShallowContradictionCount7d(
  receipts: readonly PolicyDriftReceiptEntry[],
  asOfMs: number,
): number | undefined {
  const windowReceipts = policyDriftSevenDayWindow(receipts, asOfMs);
  if (windowReceipts.length === 0) {
    return undefined;
  }

  return windowReceipts.filter((entry) =>
    isDeepShallowContradictionReceipt(entry.receipt),
  ).length;
}

function policyDriftSevenDayWindow(
  receipts: readonly PolicyDriftReceiptEntry[],
  asOfMs: number,
): readonly PolicyDriftReceiptEntry[] {
  const windowStartMs = asOfMs - 7 * KERNEL_DAY_MS;

  return receipts.filter(
    (entry) => entry.as_of_ms >= windowStartMs && entry.as_of_ms <= asOfMs,
  );
}

function escalationPrecisionLabel(
  receipt: ReceiptV0,
): "confirmed" | "refuted" | undefined {
  const confirmed = receipt.cost.tags.some((tag) =>
    ESCALATION_CONFIRMED_TAGS.has(tag),
  );
  const refuted = receipt.cost.tags.some((tag) => ESCALATION_REFUTED_TAGS.has(tag));

  if (confirmed && refuted) {
    throw new Error(
      `policy drift receipt ${receipt.content_hash} has conflicting escalation precision labels`,
    );
  }

  if (!confirmed && !refuted) {
    return undefined;
  }
  if (
    receipt.core.event_cause !== "escalation" &&
    !receipt.cost.tags.includes("escalation")
  ) {
    throw new Error(
      `policy drift receipt ${receipt.content_hash} labels escalation precision without escalation evidence`,
    );
  }

  return confirmed ? "confirmed" : "refuted";
}

function isDeepShallowContradictionReceipt(receipt: ReceiptV0): boolean {
  return (
    receipt.verdict.blocked?.reason === "backstop-divergence" ||
    receipt.cost.tags.some((tag) => DEEP_SHALLOW_CONTRADICTION_TAGS.has(tag))
  );
}

function evidenceReceiptHashesForPolicyDrift(
  receipts: readonly PolicyDriftReceiptEntry[],
  asOf: string | null,
): readonly ContentHashV0[] {
  if (asOf === null) {
    return [];
  }

  const asOfMs = parseReplayableInstantMs(asOf, "policy drift as_of");

  return receipts
    .filter((entry) => entry.as_of_ms <= asOfMs)
    .map((entry) => entry.receipt.content_hash);
}

function summarizeReceiptForPolicyAuthor(
  receipt: ReceiptV0,
): PolicyAuthorReceiptSummaryV0 {
  return {
    content_hash: receipt.content_hash,
    contract_revision: receipt.core.contract_revision,
    as_of: receipt.core.as_of,
    role: receipt.core.role,
    event_cause: receipt.core.event_cause,
    verdict_status: receipt.verdict.status,
    next_forecast_recheck: receipt.freshness.next_forecast_recheck,
    surprise_cause: receipt.cost.surprise_cause,
  };
}

function readHistoryQueryResponse(payload: unknown): PolicyAuthorHistoryQueryV0 {
  if (looksLikeAuthoredPolicy(payload)) {
    throw new Error(
      "policy author must query receipt history before authoring an artifact",
    );
  }
  if (!isRecord(payload)) {
    throw new Error("policy author history query response must be an object");
  }

  const errors: string[] = [];
  validateKnownKeys(
    payload,
    "policy author history query",
    ["schema", "v", "selected_receipt_hashes", "rationale"],
    errors,
  );
  expectLiteral(
    payload["schema"],
    POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
    "history_query.schema",
    errors,
  );
  expectLiteral(
    payload["v"],
    POLICY_ARTIFACT_VERSION,
    "history_query.v",
    errors,
  );
  const selectedReceiptHashes = readContentHashArray(
    payload["selected_receipt_hashes"],
    "history_query.selected_receipt_hashes",
    errors,
  );
  const rationale =
    payload["rationale"] === undefined
      ? undefined
      : readNonEmptyString(payload["rationale"], "history_query.rationale", errors);

  if (errors.length > 0) {
    throw new Error(`policy author history query is malformed: ${errors.join("; ")}`);
  }

  return {
    schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    selected_receipt_hashes: selectedReceiptHashes,
    ...(rationale === undefined ? {} : { rationale }),
  };
}

function assertSelectedReceiptsExist(
  query: PolicyAuthorHistoryQueryV0,
  receipts: readonly ReceiptV0[],
): void {
  if (query.selected_receipt_hashes.length === 0) {
    if (receipts.length > 0) {
      throw new Error(
        "policy author must select at least one receipt for dynamic history exploration",
      );
    }
    return;
  }

  const available = new Set(receipts.map((receipt) => receipt.content_hash));
  const unknown = query.selected_receipt_hashes.filter((hash) => !available.has(hash));

  if (unknown.length > 0) {
    throw new Error(
      `policy author selected unknown receipt hashes: ${unknown.join(", ")}`,
    );
  }
}

function selectReceipts(
  receipts: readonly ReceiptV0[],
  query: PolicyAuthorHistoryQueryV0,
): readonly ReceiptV0[] {
  const byHash = new Map(receipts.map((receipt) => [receipt.content_hash, receipt]));

  return Object.freeze(
    query.selected_receipt_hashes.map((hash) => {
      const receipt = byHash.get(hash);
      if (receipt === undefined) {
        throw new Error(`selected receipt ${hash} disappeared from history`);
      }
      return receipt;
    }),
  );
}

function readAuthoredArtifactResponse(payload: unknown): unknown {
  if (!isRecord(payload)) {
    throw new Error("policy author artifact response must be an object");
  }

  if (payload["schema"] === POLICY_AUTHOR_HISTORY_QUERY_SCHEMA) {
    throw new Error("policy author returned a second history query instead of an artifact");
  }

  if (payload["schema"] === POLICY_ARTIFACT_SCHEMA) {
    return payload;
  }

  if (payload["schema"] === POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA) {
    const artifact = payload["artifact"] ?? payload["authored_policy"];
    if (artifact === undefined) {
      throw new Error("policy author artifact response is missing artifact");
    }
    return artifact;
  }

  const authoredPolicy = payload["authored_policy"] ?? payload["artifact"];
  if (authoredPolicy !== undefined) {
    return authoredPolicy;
  }

  if (looksLikeAuthoredPolicy(payload)) {
    return payload;
  }

  throw new Error("policy author artifact response is malformed");
}

function normalizeAuthoredPolicyArtifactV0(
  value: unknown,
  context: {
    readonly responsibility_id: string;
    readonly contract_revision: ContentHashV0;
    readonly no_anchor: boolean;
    readonly live_observables: readonly PolicyLiveObservableV0[];
    readonly receipt_history_summary_hash: ContentHashV0;
    readonly history_query: PolicyAuthorHistoryQueryV0;
  },
): AuthoredPolicyArtifactV0 {
  if (!isRecord(value)) {
    throw new Error("authored policy artifact must be an object");
  }

  const responsibilityId =
    value["responsibility_id"] === undefined
      ? context.responsibility_id
      : readRequiredString(value["responsibility_id"], "artifact.responsibility_id");
  const noAnchor =
    value["no_anchor"] === undefined
      ? context.no_anchor
      : readRequiredBoolean(value["no_anchor"], "artifact.no_anchor");
  const liveObservables =
    value["live_observables"] === undefined
      ? canonicalLiveObservables(context.live_observables)
      : readRequiredLiveObservables(
          value["live_observables"],
          "artifact.live_observables",
        );

  if (responsibilityId !== context.responsibility_id) {
    throw new Error(
      `authored policy targets ${responsibilityId}, expected ${context.responsibility_id}`,
    );
  }
  if (noAnchor !== context.no_anchor) {
    throw new Error("authored policy no_anchor flag does not match responsibility");
  }
  assertSameLiveObservableIds(liveObservables, context.live_observables);

  const artifact: AuthoredPolicyArtifactV0 = {
    schema: POLICY_ARTIFACT_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    responsibility_id: responsibilityId,
    registry_id: readRequiredString(value["registry_id"], "artifact.registry_id"),
    policy_revision: readRequiredString(
      value["policy_revision"],
      "artifact.policy_revision",
    ),
    no_anchor: noAnchor,
    live_observables: liveObservables,
    cadence: readRequiredCadence(value["cadence"], noAnchor),
    hysteresis: readRequiredHysteresis(value["hysteresis"]),
    thresholds: readRequiredThresholds(value["thresholds"]),
    transitive_freshness_function:
      value["transitive_freshness_function"] === undefined
        ? DEFAULT_TRANSITIVE_FRESHNESS_FUNCTION_V0
        : readRequiredTransitiveFreshnessFunction(
            value["transitive_freshness_function"],
            "artifact.transitive_freshness_function",
          ),
    falsification_predicate: readRequiredPredicate(
      value["falsification_predicate"],
      "artifact.falsification_predicate",
    ),
    ...(value["backstop_divergence_predicate"] === undefined
      ? {}
      : {
          backstop_divergence_predicate: readRequiredPredicate(
            value["backstop_divergence_predicate"],
            "artifact.backstop_divergence_predicate",
          ),
        }),
    provenance: normalizeProvenance(value["provenance"], context),
  };

  return artifact;
}

function normalizeProvenance(
  value: unknown,
  context: {
    readonly contract_revision: ContentHashV0;
    readonly receipt_history_summary_hash: ContentHashV0;
    readonly history_query: PolicyAuthorHistoryQueryV0;
  },
): PolicyArtifactProvenanceV0 {
  if (value !== undefined) {
    const provenance = readRequiredProvenance(value, "artifact.provenance");
    if (provenance.contract_revision !== context.contract_revision) {
      throw new Error("artifact provenance contract_revision does not match input");
    }
    if (
      provenance.receipt_history_summary_hash !==
      context.receipt_history_summary_hash
    ) {
      throw new Error(
        "artifact provenance receipt_history_summary_hash does not match query",
      );
    }
    if (
      canonicalizeForReceiptV0(provenance.history_query) !==
      canonicalizeForReceiptV0(context.history_query)
    ) {
      throw new Error("artifact provenance history_query does not match query");
    }
    if (
      provenance.explored_receipt_hashes.join("\0") !==
      context.history_query.selected_receipt_hashes.join("\0")
    ) {
      throw new Error("artifact provenance explored receipt hashes do not match query");
    }

    return provenance;
  }

  return {
    contract_revision: context.contract_revision,
    receipt_history_summary_hash: context.receipt_history_summary_hash,
    explored_receipt_hashes: context.history_query.selected_receipt_hashes,
    history_query: context.history_query,
  };
}

function looksLikeAuthoredPolicy(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["schema"] === POLICY_ARTIFACT_SCHEMA ||
    value["authored_policy"] !== undefined ||
    value["artifact"] !== undefined ||
    value["registry_id"] !== undefined ||
    value["policy_revision"] !== undefined ||
    value["falsification_predicate"] !== undefined
  );
}

function readCadence(
  value: unknown,
  noAnchor: boolean | undefined,
  errors: string[],
): PolicyCadenceV0 | undefined {
  if (!isRecord(value)) {
    errors.push("policy_artifact.cadence must be an object");
    return undefined;
  }

  validateKnownKeys(
    value,
    "policy_artifact.cadence",
    ["shallow_recheck_ms", "plan_audit_ms", "deep_revalidation_ms"],
    errors,
  );
  const shallow = readPositiveSafeInteger(
    value["shallow_recheck_ms"],
    "policy_artifact.cadence.shallow_recheck_ms",
    errors,
  );
  const planAudit = readPositiveSafeInteger(
    value["plan_audit_ms"],
    "policy_artifact.cadence.plan_audit_ms",
    errors,
  );
  const deep = readPositiveSafeInteger(
    value["deep_revalidation_ms"],
    "policy_artifact.cadence.deep_revalidation_ms",
    errors,
  );

  validateCadenceValues(shallow, planAudit, deep, noAnchor, errors);

  if (shallow === undefined || planAudit === undefined || deep === undefined) {
    return undefined;
  }

  return {
    shallow_recheck_ms: shallow,
    plan_audit_ms: planAudit,
    deep_revalidation_ms: deep,
  };
}

function readHysteresis(
  value: unknown,
  errors: string[],
): PolicyHysteresisV0 | undefined {
  if (!isRecord(value)) {
    errors.push("policy_artifact.hysteresis must be an object");
    return undefined;
  }

  validateKnownKeys(
    value,
    "policy_artifact.hysteresis",
    [
      "min_recompile_interval_ms",
      "enter_degraded_threshold",
      "exit_degraded_threshold",
      "warmup_judged_activations",
    ],
    errors,
  );
  const minRecompile = readPositiveSafeInteger(
    value["min_recompile_interval_ms"],
    "policy_artifact.hysteresis.min_recompile_interval_ms",
    errors,
  );
  const enter = readUnitInterval(
    value["enter_degraded_threshold"],
    "policy_artifact.hysteresis.enter_degraded_threshold",
    errors,
  );
  const exit = readUnitInterval(
    value["exit_degraded_threshold"],
    "policy_artifact.hysteresis.exit_degraded_threshold",
    errors,
  );
  const warmup = readPositiveSafeInteger(
    value["warmup_judged_activations"],
    "policy_artifact.hysteresis.warmup_judged_activations",
    errors,
  );

  validateHysteresisValues(minRecompile, enter, exit, errors);

  if (
    minRecompile === undefined ||
    enter === undefined ||
    exit === undefined ||
    warmup === undefined
  ) {
    return undefined;
  }

  return {
    min_recompile_interval_ms: minRecompile,
    enter_degraded_threshold: enter,
    exit_degraded_threshold: exit,
    warmup_judged_activations: warmup,
  };
}

function readThresholds(
  value: unknown,
  errors: string[],
): PolicyThresholdsV0 | undefined {
  if (!isRecord(value)) {
    errors.push("policy_artifact.thresholds must be an object");
    return undefined;
  }

  validateKnownKeys(
    value,
    "policy_artifact.thresholds",
    [
      "max_calibration_divergence_multiplier",
      "escalation_precision_floor",
      "backstop_deep_contradiction_count",
      "stale_brief_minutes",
      "fresh_tokens_per_day_ceiling",
    ],
    errors,
  );
  const divergence = readPositiveFiniteNumber(
    value["max_calibration_divergence_multiplier"],
    "policy_artifact.thresholds.max_calibration_divergence_multiplier",
    errors,
  );
  const precision = readUnitInterval(
    value["escalation_precision_floor"],
    "policy_artifact.thresholds.escalation_precision_floor",
    errors,
  );
  const contradictionCount = readPositiveSafeInteger(
    value["backstop_deep_contradiction_count"],
    "policy_artifact.thresholds.backstop_deep_contradiction_count",
    errors,
  );
  const staleBriefMinutes = readPositiveSafeInteger(
    value["stale_brief_minutes"],
    "policy_artifact.thresholds.stale_brief_minutes",
    errors,
  );
  const freshTokensCeiling = readPositiveFiniteNumber(
    value["fresh_tokens_per_day_ceiling"],
    "policy_artifact.thresholds.fresh_tokens_per_day_ceiling",
    errors,
  );

  validateThresholdValues(divergence, staleBriefMinutes, errors);

  if (
    divergence === undefined ||
    precision === undefined ||
    contradictionCount === undefined ||
    staleBriefMinutes === undefined ||
    freshTokensCeiling === undefined
  ) {
    return undefined;
  }

  return {
    max_calibration_divergence_multiplier: divergence,
    escalation_precision_floor: precision,
    backstop_deep_contradiction_count: contradictionCount,
    stale_brief_minutes: staleBriefMinutes,
    fresh_tokens_per_day_ceiling: freshTokensCeiling,
  };
}

function readTransitiveFreshnessFunction(
  value: unknown,
  path: string,
  errors: string[],
): PolicyTransitiveFreshnessFunctionV0 | undefined {
  if (value === undefined) {
    return DEFAULT_TRANSITIVE_FRESHNESS_FUNCTION_V0;
  }
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const kind = value["kind"];
  if (kind === "kernel-default") {
    validateKnownKeys(value, path, ["kind"], errors);
    return { kind };
  }
  if (kind === "minimum-remaining-freshness-ms") {
    validateKnownKeys(value, path, ["kind", "minimum_remaining_ms"], errors);
    const minimumRemainingMs = readNonNegativeSafeInteger(
      value["minimum_remaining_ms"],
      `${path}.minimum_remaining_ms`,
      errors,
    );

    if (minimumRemainingMs === undefined) {
      return undefined;
    }

    return {
      kind,
      minimum_remaining_ms: minimumRemainingMs,
    };
  }

  errors.push(
    `${path}.kind must be kernel-default or minimum-remaining-freshness-ms`,
  );
  return undefined;
}

function readProvenance(
  value: unknown,
  errors: string[],
): PolicyArtifactProvenanceV0 | undefined {
  if (!isRecord(value)) {
    errors.push("policy_artifact.provenance must be an object");
    return undefined;
  }

  validateKnownKeys(
    value,
    "policy_artifact.provenance",
    [
      "contract_revision",
      "receipt_history_summary_hash",
      "explored_receipt_hashes",
      "history_query",
    ],
    errors,
  );
  const contractRevision = readContentHash(
    value["contract_revision"],
    "policy_artifact.provenance.contract_revision",
    errors,
  );
  const summaryHash = readContentHash(
    value["receipt_history_summary_hash"],
    "policy_artifact.provenance.receipt_history_summary_hash",
    errors,
  );
  const exploredReceiptHashes = readContentHashArray(
    value["explored_receipt_hashes"],
    "policy_artifact.provenance.explored_receipt_hashes",
    errors,
  );
  const historyQuery = readHistoryQuery(
    value["history_query"],
    "policy_artifact.provenance.history_query",
    errors,
  );

  if (
    contractRevision === undefined ||
    summaryHash === undefined ||
    historyQuery === undefined
  ) {
    return undefined;
  }

  return {
    contract_revision: contractRevision,
    receipt_history_summary_hash: summaryHash,
    explored_receipt_hashes: exploredReceiptHashes,
    history_query: historyQuery,
  };
}

function readHistoryQuery(
  value: unknown,
  path: string,
  errors: string[],
): PolicyAuthorHistoryQueryV0 | undefined {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  validateKnownKeys(value, path, ["schema", "v", "selected_receipt_hashes", "rationale"], errors);
  expectLiteral(value["schema"], POLICY_AUTHOR_HISTORY_QUERY_SCHEMA, `${path}.schema`, errors);
  expectLiteral(value["v"], POLICY_ARTIFACT_VERSION, `${path}.v`, errors);
  const selectedReceiptHashes = readContentHashArray(
    value["selected_receipt_hashes"],
    `${path}.selected_receipt_hashes`,
    errors,
  );
  const rationale =
    value["rationale"] === undefined
      ? undefined
      : readNonEmptyString(value["rationale"], `${path}.rationale`, errors);

  return {
    schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    selected_receipt_hashes: selectedReceiptHashes,
    ...(rationale === undefined ? {} : { rationale }),
  };
}

function readLiveObservables(
  value: unknown,
  path: string,
  errors: string[],
): readonly PolicyLiveObservableV0[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return [];
  }

  const observables: PolicyLiveObservableV0[] = [];
  const seen = new Set<string>();

  value.forEach((observable, index) => {
    const observablePath = `${path}[${index}]`;
    if (!isRecord(observable)) {
      errors.push(`${observablePath} must be an object`);
      return;
    }

    validateKnownKeys(
      observable,
      observablePath,
      ["id", "source", "description"],
      errors,
    );
    const id = readNonEmptyString(observable["id"], `${observablePath}.id`, errors);
    const source = readLiveObservableSource(
      observable["source"],
      `${observablePath}.source`,
      errors,
    );
    const description = readNonEmptyString(
      observable["description"],
      `${observablePath}.description`,
      errors,
    );

    if (id !== undefined) {
      if (seen.has(id)) {
        errors.push(`${observablePath}.id must be unique`);
      }
      seen.add(id);
    }

    if (id !== undefined && source !== undefined && description !== undefined) {
      observables.push({ id, source, description });
    }
  });

  return Object.freeze(
    observables.sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function canonicalLiveObservables(
  value: readonly PolicyLiveObservableV0[],
): readonly PolicyLiveObservableV0[] {
  return readRequiredLiveObservables(value, "live_observables");
}

function readRequiredLiveObservables(
  value: unknown,
  path: string,
): readonly PolicyLiveObservableV0[] {
  const errors: string[] = [];
  const observables = readLiveObservables(value, path, errors);

  if (errors.length > 0) {
    throw new Error(`${path} is malformed: ${errors.join("; ")}`);
  }

  return observables;
}

function assertSameLiveObservableIds(
  actual: readonly PolicyLiveObservableV0[],
  expected: readonly PolicyLiveObservableV0[],
): void {
  const actualIds = actual.map((observable) => observable.id).sort();
  const expectedIds = expected.map((observable) => observable.id).sort();

  if (actualIds.join("\0") !== expectedIds.join("\0")) {
    throw new Error("authored policy live_observables do not match replayable inputs");
  }
}

function readRequiredCadence(value: unknown, noAnchor: boolean): PolicyCadenceV0 {
  const errors: string[] = [];
  const cadence = readCadence(value, noAnchor, errors);

  if (cadence === undefined || errors.length > 0) {
    throw new Error(`artifact.cadence is malformed: ${errors.join("; ")}`);
  }

  return cadence;
}

function readRequiredHysteresis(value: unknown): PolicyHysteresisV0 {
  const errors: string[] = [];
  const hysteresis = readHysteresis(value, errors);

  if (hysteresis === undefined || errors.length > 0) {
    throw new Error(`artifact.hysteresis is malformed: ${errors.join("; ")}`);
  }

  return hysteresis;
}

function readRequiredThresholds(value: unknown): PolicyThresholdsV0 {
  const errors: string[] = [];
  const thresholds = readThresholds(value, errors);

  if (thresholds === undefined || errors.length > 0) {
    throw new Error(`artifact.thresholds is malformed: ${errors.join("; ")}`);
  }

  return thresholds;
}

function readRequiredTransitiveFreshnessFunction(
  value: unknown,
  path: string,
): PolicyTransitiveFreshnessFunctionV0 {
  const errors: string[] = [];
  const fn = readTransitiveFreshnessFunction(value, path, errors);

  if (fn === undefined || errors.length > 0) {
    throw new Error(`${path} is malformed: ${errors.join("; ")}`);
  }

  return fn;
}

function readRequiredProvenance(
  value: unknown,
  path: string,
): PolicyArtifactProvenanceV0 {
  const errors: string[] = [];
  const provenance = readProvenance(value, errors);

  if (provenance === undefined || errors.length > 0) {
    throw new Error(`${path} is malformed: ${errors.join("; ")}`);
  }

  return provenance;
}

function validateCadenceValues(
  shallow: number | undefined,
  planAudit: number | undefined,
  deep: number | undefined,
  noAnchor: boolean | undefined,
  errors: string[],
): void {
  if (shallow !== undefined && shallow < 5 * 60 * 1000) {
    errors.push("policy_artifact.cadence.shallow_recheck_ms is too tight");
  }
  if (shallow !== undefined && planAudit !== undefined && shallow > planAudit) {
    errors.push(
      "policy_artifact.cadence.plan_audit_ms must be at least shallow_recheck_ms",
    );
  }
  if (planAudit !== undefined && deep !== undefined && planAudit > deep) {
    errors.push(
      "policy_artifact.cadence.deep_revalidation_ms must be at least plan_audit_ms",
    );
  }
  if (
    noAnchor === true &&
    deep !== undefined &&
    deep > KERNEL_BACKSTOPS.maxUnforcedDeepIntervalMs
  ) {
    errors.push(
      "policy_artifact.cadence.deep_revalidation_ms may not exceed the B2 deep interval",
    );
  }
}

function validateHysteresisValues(
  minRecompile: number | undefined,
  enter: number | undefined,
  exit: number | undefined,
  errors: string[],
): void {
  if (
    minRecompile !== undefined &&
    minRecompile < KERNEL_BACKSTOPS.minRecompileIntervalMs
  ) {
    errors.push(
      "policy_artifact.hysteresis.min_recompile_interval_ms may not shorten the kernel floor",
    );
  }
  if (enter !== undefined && exit !== undefined && exit >= enter) {
    errors.push(
      "policy_artifact.hysteresis.exit_degraded_threshold must be below enter_degraded_threshold",
    );
  }
}

function validateThresholdValues(
  divergence: number | undefined,
  staleBriefMinutes: number | undefined,
  errors: string[],
): void {
  if (
    divergence !== undefined &&
    (divergence <= 1 ||
      divergence > KERNEL_BACKSTOPS.maxCalibrationDivergenceMultiplier)
  ) {
    errors.push(
      "policy_artifact.thresholds.max_calibration_divergence_multiplier must trip before the kernel ceiling",
    );
  }
  if (
    staleBriefMinutes !== undefined &&
    staleBriefMinutes * 60 * 1000 > KERNEL_DAY_MS
  ) {
    errors.push("policy_artifact.thresholds.stale_brief_minutes must fit inside a day");
  }
}

function rejectOffLivePredicateFacts(
  predicate: KernelPredicateExpression,
  path: string,
  liveObservableIds: readonly string[],
  errors: string[],
): void {
  const liveObservableSet = new Set(liveObservableIds);
  const offLiveFacts = collectPredicateFacts(predicate).filter(
    (fact) => !liveObservableSet.has(fact),
  );

  if (offLiveFacts.length > 0) {
    errors.push(`${path} references non-live observable facts: ${offLiveFacts.join(", ")}`);
  }
}

function readPredicate(
  value: unknown,
  path: string,
  errors: string[],
): KernelPredicateExpression | undefined {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const kind = value["kind"];
  switch (kind) {
    case "equals":
    case "not-equals":
      return readFactPredicate(value, path, errors, false);
    case "greater-than-or-equal":
    case "less-than":
      return readFactPredicate(value, path, errors, true);
    case "and":
    case "or":
      return readVariadicPredicate(value, path, errors);
    case "not": {
      validateKnownKeys(value, path, ["kind", "predicate"], errors);
      const predicate = readPredicate(value["predicate"], `${path}.predicate`, errors);
      return predicate === undefined ? undefined : { kind, predicate };
    }
    default:
      errors.push(`${path}.kind is not supported`);
      return undefined;
  }
}

function readRequiredPredicate(
  value: unknown,
  path: string,
): KernelPredicateExpression {
  const errors: string[] = [];
  const predicate = readPredicate(value, path, errors);

  if (predicate === undefined || errors.length > 0) {
    throw new Error(`${path} is malformed: ${errors.join("; ")}`);
  }

  return predicate;
}

function readFactPredicate(
  value: Readonly<Record<string, unknown>>,
  path: string,
  errors: string[],
  numeric: boolean,
): KernelPredicateExpression | undefined {
  validateKnownKeys(value, path, ["kind", "fact", "value"], errors);
  const kind = value["kind"];
  const fact = readNonEmptyString(value["fact"], `${path}.fact`, errors);
  const expected = value["value"];

  if (
    kind !== "equals" &&
    kind !== "not-equals" &&
    kind !== "greater-than-or-equal" &&
    kind !== "less-than"
  ) {
    errors.push(`${path}.kind is not a fact predicate`);
    return undefined;
  }

  if (numeric) {
    if (typeof expected !== "number" || !Number.isFinite(expected)) {
      errors.push(`${path}.value must be a finite numeric threshold`);
      return undefined;
    }
  } else if (!isKernelFactValue(expected)) {
    errors.push(`${path}.value must be a kernel fact value`);
    return undefined;
  }

  if (fact === undefined) {
    return undefined;
  }

  return {
    kind,
    fact,
    value: expected as string | number | boolean | null,
  } as KernelPredicateExpression;
}

function readVariadicPredicate(
  value: Readonly<Record<string, unknown>>,
  path: string,
  errors: string[],
): KernelPredicateExpression | undefined {
  validateKnownKeys(value, path, ["kind", "predicates"], errors);
  const kind = value["kind"];
  const predicates = value["predicates"];

  if (kind !== "and" && kind !== "or") {
    errors.push(`${path}.kind is not a variadic predicate`);
    return undefined;
  }
  if (!Array.isArray(predicates) || predicates.length === 0) {
    errors.push(`${path}.predicates must be a non-empty array`);
    return undefined;
  }

  const parsed: KernelPredicateExpression[] = [];
  predicates.forEach((predicate, index) => {
    const parsedPredicate = readPredicate(predicate, `${path}.predicates[${index}]`, errors);
    if (parsedPredicate !== undefined) {
      parsed.push(parsedPredicate);
    }
  });

  if (parsed.length !== predicates.length) {
    return undefined;
  }

  return { kind, predicates: parsed };
}

function collectPredicateFacts(
  expression: KernelPredicateExpression,
): readonly string[] {
  const facts = new Set<string>();
  collectFacts(expression, facts);
  return [...facts].sort((left, right) => left.localeCompare(right));
}

function collectFacts(expression: KernelPredicateExpression, facts: Set<string>): void {
  switch (expression.kind) {
    case "equals":
    case "not-equals":
    case "greater-than-or-equal":
    case "less-than":
      facts.add(expression.fact);
      return;
    case "and":
    case "or":
      expression.predicates.forEach((predicate) => collectFacts(predicate, facts));
      return;
    case "not":
      collectFacts(expression.predicate, facts);
      return;
  }
}

function readRequiredString(value: unknown, path: string): string {
  const errors: string[] = [];
  const result = readNonEmptyString(value, path, errors);

  if (result === undefined) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return result;
}

function readRequiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be boolean`);
  }

  return value;
}

function readBoolean(
  value: unknown,
  path: string,
  errors: string[],
): boolean | undefined {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be boolean`);
    return undefined;
  }

  return value;
}

function readNonEmptyString(
  value: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return undefined;
  }

  return value;
}

function readPositiveSafeInteger(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    errors.push(`${path} must be a positive safe integer`);
    return undefined;
  }

  return value as number;
}

function readNonNegativeSafeInteger(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    errors.push(`${path} must be a non-negative safe integer`);
    return undefined;
  }

  return value as number;
}

function readPositiveFiniteNumber(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(`${path} must be a positive finite number`);
    return undefined;
  }

  return value;
}

function readUnitInterval(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1) {
    errors.push(`${path} must be inside the open unit interval`);
    return undefined;
  }

  return value;
}

function readLiveObservableSource(
  value: unknown,
  path: string,
  errors: string[],
): PolicyLiveObservableSourceV0 | undefined {
  if (typeof value !== "string" || !LIVE_OBSERVABLE_SOURCES.has(value as PolicyLiveObservableSourceV0)) {
    errors.push(`${path} must be a replayable live observable source`);
    return undefined;
  }

  return value as PolicyLiveObservableSourceV0;
}

function readContentHash(
  value: unknown,
  path: string,
  errors: string[],
): ContentHashV0 | undefined {
  if (!isContentHash(value)) {
    errors.push(`${path} must be a sha256 content address`);
    return undefined;
  }

  return value;
}

function readContentHashArray(
  value: unknown,
  path: string,
  errors: string[],
): readonly ContentHashV0[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }

  const hashes: ContentHashV0[] = [];
  const seen = new Set<string>();

  value.forEach((item, index) => {
    const hash = readContentHash(item, `${path}[${index}]`, errors);
    if (hash === undefined) {
      return;
    }
    if (seen.has(hash)) {
      errors.push(`${path}[${index}] must not duplicate a receipt hash`);
      return;
    }
    seen.add(hash);
    hashes.push(hash);
  });

  return Object.freeze(hashes.sort((left, right) => left.localeCompare(right)));
}

function expectLiteral(
  value: unknown,
  expected: string | number,
  path: string,
  errors: string[],
): void {
  if (value !== expected) {
    errors.push(`${path} must be ${JSON.stringify(expected)}`);
  }
}

function validateKnownKeys(
  value: Readonly<Record<string, unknown>>,
  path: string,
  allowed: readonly string[],
  errors: string[],
): void {
  const allowedSet = new Set(allowed);

  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      errors.push(`${path}.${key} is not part of v0`);
    }
  }
}

function isContentHash(value: unknown): value is ContentHashV0 {
  return typeof value === "string" && CONTENT_HASH_PATTERN.test(value);
}

function parseReplayableInstantMs(value: string, path: string): number {
  if (!ISO_INSTANT_PATTERN.test(value)) {
    throw new Error(`${path} must be a replayable ISO instant`);
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${path} must be a replayable ISO instant`);
  }

  return parsed;
}

function isKernelFactValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
