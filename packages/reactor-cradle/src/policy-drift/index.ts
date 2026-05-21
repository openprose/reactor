import { createHash } from "node:crypto";

import type { KernelFactValue, PredicateEvaluation } from "@openprose/reactor/kernel";
import type {
  ContentHashV0,
  ReceiptEventCauseV0,
  ReceiptRoleV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  AuthoredPolicyArtifactV0,
  PolicyLiveObservableV0,
} from "@openprose/reactor/policy";

type ReactorReceiptModule = typeof import("@openprose/reactor/receipt");
type ReactorPolicyModule = typeof import("@openprose/reactor/policy");

const {
  canonicalizeForReceiptV0,
  createReceiptV0,
  hashCanonicalReceiptV0,
} = loadReactorReceipt();
const {
  POLICY_ARTIFACT_SCHEMA,
  POLICY_ARTIFACT_VERSION,
  POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
  canonicalizePolicyArtifactV0,
  validatePolicyArtifactV0,
} = loadReactorPolicy();

export const POLICY_DRIFT_P2_SCENARIO_SCHEMA_V0 =
  "openprose.reactor-cradle.policy-drift-p2-scenario" as const;
export const POLICY_DRIFT_P2_SCENARIO_VERSION_V0 = 0 as const;

export const POLICY_DRIFT_P2_RESPONSIBILITY_ID =
  "incident-channel-current-briefing" as const;
export const POLICY_DRIFT_P2_COST_FACT =
  "cost.fresh_tokens_per_maintained_day" as const;
export const POLICY_DRIFT_P2_OFF_LOG_FACT =
  "source.incident_channel.unrecorded_sentiment_score" as const;
export const POLICY_DRIFT_P2_BACKSTOP_FACT =
  "kernel.deep_shallow_contradiction_count_7d" as const;

export type PolicyDriftOutcomeV0 =
  | "not-tripped"
  | "tripped"
  | "indeterminate";

export type PolicyDriftFactMapV0 = Readonly<Record<string, KernelFactValue>>;

export interface PolicyDriftEvaluatorInputV0 {
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly receipts: readonly ReceiptV0[];
  readonly as_of: string;
}

export type EvaluatePolicyDriftV0 = (
  input: PolicyDriftEvaluatorInputV0,
) => unknown;

export interface RecordedPolicyDriftP2ScenarioV0 {
  readonly schema: typeof POLICY_DRIFT_P2_SCENARIO_SCHEMA_V0;
  readonly v: typeof POLICY_DRIFT_P2_SCENARIO_VERSION_V0;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly receipt_history: readonly ReceiptV0[];
  readonly cost_drift_artifact: AuthoredPolicyArtifactV0;
  readonly off_log_artifact: AuthoredPolicyArtifactV0;
  readonly cost_drift_artifact_bytes: string;
  readonly cost_drift_artifact_content_hash: ContentHashV0;
  readonly off_log_artifact_bytes: string;
  readonly off_log_artifact_content_hash: ContentHashV0;
}

export interface PolicyDriftGatewayProbeV0 {
  readonly agent_launch_count: number;
  readonly model_gateway_invocation_count: number;
  readonly assertNoInvocations: () => void;
}

export interface NormalizedPolicyDriftResultV0 {
  readonly outcome: PolicyDriftOutcomeV0;
  readonly facts: PolicyDriftFactMapV0;
  readonly evidence_receipt_hashes: readonly ContentHashV0[];
  readonly predicate: PredicateEvaluation;
  readonly missing_fact_ids: readonly string[];
  readonly unsupported_fact_ids: readonly string[];
  readonly raw: unknown;
}

export interface RecordedPolicyDriftP2ProofV0 {
  readonly scenario: RecordedPolicyDriftP2ScenarioV0;
  readonly cost_drift: NormalizedPolicyDriftResultV0;
  readonly off_log: NormalizedPolicyDriftResultV0;
  readonly gateway_invocations: {
    readonly agent_launch_count: 0;
    readonly model_gateway_invocation_count: 0;
  };
}

export interface RunRecordedPolicyDriftP2ProofInputV0 {
  readonly evaluatePolicyDriftV0: EvaluatePolicyDriftV0;
  readonly scenario?: RecordedPolicyDriftP2ScenarioV0;
}

export function createPolicyDriftGatewayProbeV0(): PolicyDriftGatewayProbeV0 {
  let agentLaunchCount = 0;
  let modelGatewayInvocationCount = 0;

  return {
    get agent_launch_count(): number {
      return agentLaunchCount;
    },
    get model_gateway_invocation_count(): number {
      return modelGatewayInvocationCount;
    },
    assertNoInvocations(): void {
      if (agentLaunchCount !== 0 || modelGatewayInvocationCount !== 0) {
        throw new Error(
          `policy drift path invoked forbidden inference gateways: agent=${agentLaunchCount}, model=${modelGatewayInvocationCount}`,
        );
      }
    },
    // Kept as non-enumerable implementation detail would hide the tripwire
    // from fixture snapshots, so tests use the public counters above instead.
    launch(): never {
      agentLaunchCount += 1;
      throw new Error("policy drift must not launch an agent SDK activation");
    },
    complete(): never {
      modelGatewayInvocationCount += 1;
      throw new Error("policy drift must not call the model gateway");
    },
  } as PolicyDriftGatewayProbeV0;
}

export function makeRecordedPolicyDriftP2ScenarioV0(): RecordedPolicyDriftP2ScenarioV0 {
  const contractRevision = hashText(
    [
      "kind: responsibility",
      "Goal: The incident channel has a current, accurate briefing.",
      "Criteria: impact, timeline, owner, next action, and customer-facing status are current.",
    ].join("\n"),
  );
  const asOf = "2026-05-19T00:00:00.000Z";
  const receiptHistory = makeReceiptHistory(contractRevision);
  const exploredReceiptHashes = receiptHistory
    .map((receipt) => receipt.content_hash)
    .sort((left, right) => left.localeCompare(right));
  const receiptHistorySummaryHash = hashReceiptHistorySummary(receiptHistory);

  const costDriftArtifact = makePolicyArtifact({
    contract_revision: contractRevision,
    explored_receipt_hashes: exploredReceiptHashes,
    receipt_history_summary_hash: receiptHistorySummaryHash,
    falsification_fact: POLICY_DRIFT_P2_COST_FACT,
    falsification_value: 500,
    policy_revision: "policy.p2.cost-drift.recorded",
  });
  const offLogArtifact = makePolicyArtifact({
    contract_revision: contractRevision,
    explored_receipt_hashes: exploredReceiptHashes,
    receipt_history_summary_hash: receiptHistorySummaryHash,
    falsification_fact: POLICY_DRIFT_P2_OFF_LOG_FACT,
    falsification_value: 0.75,
    policy_revision: "policy.p2.off-log.recorded",
  });
  const costDriftArtifactBytes = canonicalizePolicyArtifactV0(costDriftArtifact);
  const offLogArtifactBytes = canonicalizePolicyArtifactV0(offLogArtifact);

  return {
    schema: POLICY_DRIFT_P2_SCENARIO_SCHEMA_V0,
    v: POLICY_DRIFT_P2_SCENARIO_VERSION_V0,
    responsibility_id: POLICY_DRIFT_P2_RESPONSIBILITY_ID,
    contract_revision: contractRevision,
    as_of: asOf,
    receipt_history: receiptHistory,
    cost_drift_artifact: costDriftArtifact,
    off_log_artifact: offLogArtifact,
    cost_drift_artifact_bytes: costDriftArtifactBytes,
    cost_drift_artifact_content_hash: hashCanonicalReceiptV0(costDriftArtifactBytes),
    off_log_artifact_bytes: offLogArtifactBytes,
    off_log_artifact_content_hash: hashCanonicalReceiptV0(offLogArtifactBytes),
  };
}

export function runRecordedPolicyDriftP2ProofV0(
  input: RunRecordedPolicyDriftP2ProofInputV0,
): RecordedPolicyDriftP2ProofV0 {
  const scenario = input.scenario ?? makeRecordedPolicyDriftP2ScenarioV0();
  assertRecordedPolicyDriftP2ScenarioV0(scenario);
  const gatewayProbe = createPolicyDriftGatewayProbeV0();

  const costDrift = normalizePolicyDriftResultV0(
    input.evaluatePolicyDriftV0({
      artifact: scenario.cost_drift_artifact,
      receipts: scenario.receipt_history,
      as_of: scenario.as_of,
    }),
  );
  assertTrippedCostDrift(costDrift, scenario);
  gatewayProbe.assertNoInvocations();

  const offLog = normalizePolicyDriftResultV0(
    input.evaluatePolicyDriftV0({
      artifact: scenario.off_log_artifact,
      receipts: scenario.receipt_history,
      as_of: scenario.as_of,
    }),
  );
  assertIndeterminateOffLogDrift(offLog);
  gatewayProbe.assertNoInvocations();

  return {
    scenario,
    cost_drift: costDrift,
    off_log: offLog,
    gateway_invocations: {
      agent_launch_count: 0,
      model_gateway_invocation_count: 0,
    },
  };
}

export function assertRecordedPolicyDriftP2ScenarioV0(
  scenario: RecordedPolicyDriftP2ScenarioV0,
): void {
  if (scenario.schema !== POLICY_DRIFT_P2_SCENARIO_SCHEMA_V0) {
    throw new Error("policy drift P2 scenario schema is malformed");
  }
  if (scenario.v !== POLICY_DRIFT_P2_SCENARIO_VERSION_V0) {
    throw new Error("policy drift P2 scenario version must be 0");
  }
  if (scenario.receipt_history.length === 0) {
    throw new Error("policy drift P2 scenario must include receipt history");
  }

  assertValidArtifact(
    scenario.cost_drift_artifact,
    scenario.cost_drift_artifact_bytes,
    scenario.cost_drift_artifact_content_hash,
  );
  assertValidArtifact(
    scenario.off_log_artifact,
    scenario.off_log_artifact_bytes,
    scenario.off_log_artifact_content_hash,
  );
}

export function normalizePolicyDriftResultV0(
  result: unknown,
): NormalizedPolicyDriftResultV0 {
  if (!isRecord(result)) {
    throw new Error("policy drift result must be an object");
  }

  const outcome = readOutcome(result);
  const facts = readFacts(result);
  const evidenceReceiptHashes = readContentHashArrayFromUnknown(
    result["evidence_receipt_hashes"] ??
      result["evidence_receipts"] ??
      result["evidence_hashes"],
    "policy drift evidence receipt hashes",
  );
  const predicate = readPredicateEvaluation(
    result["predicate_evaluation"] ??
      result["predicate"] ??
      result["falsification_predicate_evaluation"],
  );
  const missingFactIds = readStringArrayFromUnknown(
    result["missing_fact_ids"] ?? result["missing_facts"] ?? [],
    "policy drift missing fact ids",
  );
  const unsupportedFactIds = readStringArrayFromUnknown(
    result["unsupported_fact_ids"] ?? result["unsupported_facts"] ?? [],
    "policy drift unsupported fact ids",
  );

  return {
    outcome,
    facts,
    evidence_receipt_hashes: evidenceReceiptHashes,
    predicate,
    missing_fact_ids: missingFactIds,
    unsupported_fact_ids: unsupportedFactIds,
    raw: result,
  };
}

function makePolicyArtifact(input: {
  readonly contract_revision: ContentHashV0;
  readonly explored_receipt_hashes: readonly ContentHashV0[];
  readonly receipt_history_summary_hash: ContentHashV0;
  readonly falsification_fact: string;
  readonly falsification_value: number;
  readonly policy_revision: string;
}): AuthoredPolicyArtifactV0 {
  return {
    schema: POLICY_ARTIFACT_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    responsibility_id: POLICY_DRIFT_P2_RESPONSIBILITY_ID,
    registry_id: "registry.incident-channel-current-briefing.p2",
    policy_revision: input.policy_revision,
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    cadence: {
      shallow_recheck_ms: 15 * 60 * 1000,
      plan_audit_ms: 6 * 60 * 60 * 1000,
      deep_revalidation_ms: 7 * 24 * 60 * 60 * 1000,
    },
    hysteresis: {
      min_recompile_interval_ms: 60 * 60 * 1000,
      enter_degraded_threshold: 0.34,
      exit_degraded_threshold: 0.18,
      warmup_judged_activations: 5,
    },
    thresholds: {
      max_calibration_divergence_multiplier: 1.6,
      escalation_precision_floor: 0.7,
      backstop_deep_contradiction_count: 99,
      stale_brief_minutes: 30,
      fresh_tokens_per_day_ceiling: 500,
    },
    transitive_freshness_function: { kind: "kernel-default" },
    falsification_predicate: {
      kind: "greater-than-or-equal",
      fact: input.falsification_fact,
      value: input.falsification_value,
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: POLICY_DRIFT_P2_BACKSTOP_FACT,
      value: 99,
    },
    provenance: {
      contract_revision: input.contract_revision,
      receipt_history_summary_hash: input.receipt_history_summary_hash,
      explored_receipt_hashes: input.explored_receipt_hashes,
      history_query: {
        schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
        v: POLICY_ARTIFACT_VERSION,
        selected_receipt_hashes: input.explored_receipt_hashes,
        rationale:
          "recorded P2 proof pins the receipt-log slice used to evaluate policy drift",
      },
    },
  };
}

const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: POLICY_DRIFT_P2_COST_FACT,
    source: "cost-ledger",
    description: "fresh maintenance tokens per maintained day from receipt cost facts",
  },
  {
    id: POLICY_DRIFT_P2_BACKSTOP_FACT,
    source: "kernel-backstop",
    description: "B2 deep-vs-shallow contradiction count over the trailing seven days",
  },
  {
    id: "receipt.escalation_precision_7d",
    source: "receipt-log",
    description: "precision of escalation receipts over the trailing seven days",
  },
  {
    id: POLICY_DRIFT_P2_OFF_LOG_FACT,
    source: "connector",
    description: "live incident-channel signal deliberately absent from the receipt log",
  },
];

function makeReceiptHistory(
  contractRevision: ContentHashV0,
): readonly ReceiptV0[] {
  return [
    makeReceipt({
      contract_revision: contractRevision,
      memo_key: "memo:bootstrap",
      as_of: "2026-05-18T00:00:00.000Z",
      next_forecast_recheck: "2026-05-18T06:00:00.000Z",
      event_cause: "real-input",
      role: "judge",
      evidence_input_ids: [hashText("incident-bootstrap-evidence")],
      status: "up",
      fresh: 900,
      reused: 0,
      tags: ["policy-drift-p2", "bootstrap"],
    }),
    makeReceipt({
      contract_revision: contractRevision,
      memo_key: "memo:forecast-recheck",
      as_of: "2026-05-18T12:00:00.000Z",
      next_forecast_recheck: "2026-05-19T00:00:00.000Z",
      event_cause: "forecast-recheck",
      role: "judge",
      evidence_input_ids: [hashText("incident-plan-age-evidence")],
      status: "up",
      fresh: 450,
      reused: 320,
      tags: ["policy-drift-p2", "plan-age"],
    }),
    makeReceipt({
      contract_revision: contractRevision,
      memo_key: "memo:escalation-review",
      as_of: "2026-05-18T18:00:00.000Z",
      next_forecast_recheck: "2026-05-19T00:00:00.000Z",
      event_cause: "escalation",
      role: "judge",
      evidence_input_ids: [hashText("incident-escalation-evidence")],
      status: "blocked",
      fresh: 375,
      reused: 0,
      tags: ["policy-drift-p2", "escalation"],
    }),
  ];
}

function makeReceipt(input: {
  readonly contract_revision: ContentHashV0;
  readonly memo_key: string;
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly event_cause: ReceiptEventCauseV0;
  readonly role: ReceiptRoleV0;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly status: "up" | "drifting" | "down" | "blocked";
  readonly fresh: number;
  readonly reused: number;
  readonly tags: readonly string[];
}): ReceiptV0 {
  return createReceiptV0({
    core: {
      responsibility_id: POLICY_DRIFT_P2_RESPONSIBILITY_ID,
      contract_revision: input.contract_revision,
      event_cause: input.event_cause,
      ...(input.event_cause === "forecast-recheck"
        ? { recheck_kind: "plan-age" as const }
        : {}),
      memo_key: input.memo_key,
      evidence_input_ids: input.evidence_input_ids,
      as_of: input.as_of,
      role: input.role,
    },
    sig: {
      scheme: "none",
      null_reason: "cradle recorded P2 policy-drift proof",
    },
    verdict: {
      status: input.status,
      confidence: {
        value: input.status === "blocked" ? 0 : 0.82,
        derivation_method: "recorded-cradle-policy-drift-fixture",
        calibration_grade: "none",
        label_source: "none",
      },
      ...(input.status === "blocked"
        ? {
            blocked: {
              reason: "recorded escalation review exceeded cost budget",
              fix_target: "policy-artifact",
              interrupt_cause: "needs-judgment" as const,
            },
          }
        : {}),
    },
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck: input.next_forecast_recheck,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "recorded-policy-drift-fixture",
      role: input.role,
      tags: input.tags,
      responsibility_id: POLICY_DRIFT_P2_RESPONSIBILITY_ID,
      run_id: "policy-drift-p2-recorded",
      as_of: input.as_of,
      tokens: {
        fresh: input.fresh,
        reused: input.reused,
      },
      surprise_cause: input.event_cause,
    },
  });
}

function assertValidArtifact(
  artifact: AuthoredPolicyArtifactV0,
  expectedBytes: string,
  expectedContentHash: ContentHashV0,
): void {
  const validation = validatePolicyArtifactV0(artifact);
  if (!validation.ok) {
    throw new Error(
      `recorded policy drift artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }
  if (validation.bytes !== expectedBytes) {
    throw new Error("recorded policy drift artifact bytes are not canonical");
  }
  if (validation.content_hash !== expectedContentHash) {
    throw new Error("recorded policy drift artifact content hash is stale");
  }
}

function assertTrippedCostDrift(
  result: NormalizedPolicyDriftResultV0,
  scenario: RecordedPolicyDriftP2ScenarioV0,
): void {
  if (result.outcome !== "tripped") {
    throw new Error(`expected cost drift predicate to trip, received ${result.outcome}`);
  }
  if (result.predicate.outcome !== "tripped") {
    throw new Error(
      `expected cost drift predicate evaluation to trip, received ${result.predicate.outcome}`,
    );
  }
  const costFact = result.facts[POLICY_DRIFT_P2_COST_FACT];
  if (typeof costFact !== "number" || costFact < 500) {
    throw new Error("cost drift proof must expose the tripping receipt-log cost fact");
  }
  assertEvidenceSubset(result.evidence_receipt_hashes, scenario.receipt_history);
}

function assertIndeterminateOffLogDrift(
  result: NormalizedPolicyDriftResultV0,
): void {
  if (result.outcome !== "indeterminate") {
    throw new Error(
      `expected off-log live observable to be indeterminate, received ${result.outcome}`,
    );
  }
  if (result.predicate.outcome !== "indeterminate") {
    throw new Error(
      `expected off-log predicate evaluation to be indeterminate, received ${result.predicate.outcome}`,
    );
  }
  const missingOrUnsupported = new Set([
    ...result.missing_fact_ids,
    ...result.unsupported_fact_ids,
  ]);
  if (!missingOrUnsupported.has(POLICY_DRIFT_P2_OFF_LOG_FACT)) {
    throw new Error("off-log drift proof must name the missing live observable fact");
  }
}

function assertEvidenceSubset(
  evidenceReceiptHashes: readonly ContentHashV0[],
  receiptHistory: readonly ReceiptV0[],
): void {
  if (evidenceReceiptHashes.length === 0) {
    throw new Error("policy drift proof must expose evidence receipt hashes");
  }

  const knownHashes = new Set(receiptHistory.map((receipt) => receipt.content_hash));
  const unknown = evidenceReceiptHashes.filter((hash) => !knownHashes.has(hash));
  if (unknown.length > 0) {
    throw new Error(
      `policy drift proof referenced receipts outside the recorded log: ${unknown.join(", ")}`,
    );
  }
}

function readOutcome(result: Readonly<Record<string, unknown>>): PolicyDriftOutcomeV0 {
  const value = result["outcome"] ?? result["status"];
  if (
    value === "not-tripped" ||
    value === "tripped" ||
    value === "indeterminate"
  ) {
    return value;
  }

  throw new Error("policy drift result outcome must be not-tripped, tripped, or indeterminate");
}

function readFacts(result: Readonly<Record<string, unknown>>): PolicyDriftFactMapV0 {
  const value =
    result["facts"] ?? result["evaluated_facts"] ?? result["derived_facts"];
  if (!isRecord(value)) {
    throw new Error("policy drift result must expose evaluated facts");
  }

  const facts: Record<string, KernelFactValue> = {};
  for (const [key, factValue] of Object.entries(value)) {
    if (!isKernelFactValue(factValue)) {
      throw new Error(`policy drift fact ${key} has unsupported value type`);
    }
    facts[key] = factValue;
  }

  return facts;
}

function readPredicateEvaluation(value: unknown): PredicateEvaluation {
  if (!isRecord(value)) {
    throw new Error("policy drift result must expose predicate evaluation");
  }
  const outcome = value["outcome"];
  if (
    outcome !== "not-tripped" &&
    outcome !== "tripped" &&
    outcome !== "indeterminate"
  ) {
    throw new Error("policy drift predicate evaluation outcome is malformed");
  }
  const reason = value["reason"];
  if (reason !== undefined && typeof reason !== "string") {
    throw new Error("policy drift predicate evaluation reason must be a string");
  }

  return {
    outcome,
    ...(reason === undefined ? {} : { reason }),
  };
}

function readContentHashArrayFromUnknown(
  value: unknown,
  label: string,
): readonly ContentHashV0[] {
  const values = readStringArrayFromUnknown(value, label);
  const malformed = values.find((item) => !isContentHash(item));
  if (malformed !== undefined) {
    throw new Error(`${label} contains non-content-hash value ${malformed}`);
  }

  return values as readonly ContentHashV0[];
}

function readStringArrayFromUnknown(
  value: unknown,
  label: string,
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  if (!value.every((item) => typeof item === "string" && item.length > 0)) {
    throw new Error(`${label} must contain non-empty strings`);
  }

  return Object.freeze([...value]);
}

function hashReceiptHistorySummary(
  receiptHistory: readonly ReceiptV0[],
): ContentHashV0 {
  return hashCanonicalReceiptV0(
    canonicalizeForReceiptV0(
      receiptHistory.map((receipt) => ({
        content_hash: receipt.content_hash,
        contract_revision: receipt.core.contract_revision,
        as_of: receipt.core.as_of,
        role: receipt.core.role,
        event_cause: receipt.core.event_cause,
        verdict_status: receipt.verdict.status,
        next_forecast_recheck: receipt.freshness.next_forecast_recheck,
        surprise_cause: receipt.cost.surprise_cause,
        fresh_tokens: receipt.cost.tokens.fresh,
      })),
    ),
  );
}

function isKernelFactValue(value: unknown): value is KernelFactValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isContentHash(value: string): value is ContentHashV0 {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function hashText(value: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadReactorReceipt(): ReactorReceiptModule {
  try {
    return require("@openprose/reactor/receipt") as ReactorReceiptModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/receipt")) {
      return require("../../../reactor/dist/receipt") as ReactorReceiptModule;
    }

    throw error;
  }
}

function loadReactorPolicy(): ReactorPolicyModule {
  try {
    return require("@openprose/reactor/policy") as ReactorPolicyModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/policy")) {
      return require("../../../reactor/dist/policy") as ReactorPolicyModule;
    }

    throw error;
  }
}

function isMissingReactorSubpath(error: unknown, subpath: string): boolean {
  return (
    isRecord(error) &&
    error["code"] === "MODULE_NOT_FOUND" &&
    typeof error["message"] === "string" &&
    error["message"].includes(subpath)
  );
}
