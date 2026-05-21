import { createHash } from "node:crypto";

import type {
  CompiledEvidencePlan,
  DeepRoamDiscovery,
  DeepRoamReconciliation,
  ShallowEvidencePlanResult,
} from "@openprose/reactor/evidence-plan";
import type {
  AuthoredPolicyArtifactV0,
  PolicyLiveObservableV0,
} from "@openprose/reactor/policy";
import type {
  ContentHashV0,
  ReceiptEventCauseV0,
  ReceiptRoleV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";

import {
  type NormalizedPolicyRecompileDecisionV0,
  type PlanPolicyRecompileV0,
  normalizePolicyRecompileDecisionV0,
} from "../recompile";

type ReactorEvidencePlanModule = typeof import("@openprose/reactor/evidence-plan");
type ReactorPolicyModule = typeof import("@openprose/reactor/policy");
type ReactorReceiptModule = typeof import("@openprose/reactor/receipt");

const {
  executeShallowEvidencePlan,
  reconcileDeepRoam,
} = loadReactorEvidencePlan();
const {
  POLICY_ARTIFACT_SCHEMA,
  POLICY_ARTIFACT_VERSION,
  POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
  validatePolicyArtifactV0,
} = loadReactorPolicy();
const {
  canonicalizeForReceiptV0,
  createReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} = loadReactorReceipt();

export const POLICY_ROLLBACK_D2_SCENARIO_SCHEMA_V0 =
  "openprose.reactor-cradle.rollback-d2-scenario" as const;
export const POLICY_ROLLBACK_D2_SCENARIO_VERSION_V0 = 0 as const;
export const PLAN_INCOMPLETE_D2_SCENARIO_SCHEMA_V0 =
  "openprose.reactor-cradle.plan-incomplete-d2-scenario" as const;
export const PLAN_INCOMPLETE_D2_SCENARIO_VERSION_V0 = 0 as const;

export const ROLLBACK_D2_RESPONSIBILITY_ID =
  "incident-channel-current-briefing" as const;
export const PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID = "crm-owner-map" as const;
export const PLAN_INCOMPLETE_D2_BACKSTOP_FACT =
  "kernel.deep_shallow_contradiction_count_7d" as const;

export type PolicyRollbackDecisionOutcomeV0 =
  | "rollback"
  | "keep-current"
  | "no-last-known-good";

export type PlanPolicyRollbackV0 = (
  input: PolicyRollbackPlanInputV0,
) => Promise<unknown> | unknown;

export interface RecordedPolicyTripSummaryV0 {
  readonly policy_revision: string;
  readonly judged_activations_before_trip: number;
  readonly activated_at: string;
  readonly first_trip_at: string;
}

export interface RecordedPolicyRollbackD2ScenarioV0 {
  readonly schema: typeof POLICY_ROLLBACK_D2_SCENARIO_SCHEMA_V0;
  readonly v: typeof POLICY_ROLLBACK_D2_SCENARIO_VERSION_V0;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly fresh_policy: RecordedPolicyTripSummaryV0;
  readonly last_known_good_policy: RecordedPolicyTripSummaryV0;
}

export interface PolicyRollbackPlanInputV0 {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly fresh_policy_revision: string;
  readonly fresh_policy_judged_activations_before_trip: number;
  readonly last_known_good_revision?: string;
  readonly last_known_good_judged_activations_before_trip?: number;
  readonly policy_trip_history: readonly RecordedPolicyTripSummaryV0[];
}

export interface NormalizedPolicyRollbackDecisionV0 {
  readonly outcome: PolicyRollbackDecisionOutcomeV0;
  readonly fresh_policy_revision: string;
  readonly fresh_policy_judged_activations_before_trip: number;
  readonly last_known_good_revision?: string;
  readonly last_known_good_judged_activations_before_trip?: number;
  readonly target_policy_revision?: string;
  readonly raw: unknown;
}

export interface RecordedPolicyRollbackD2ProofV0 {
  readonly scenario: RecordedPolicyRollbackD2ScenarioV0;
  readonly decision: NormalizedPolicyRollbackDecisionV0;
  readonly gateway_invocations: {
    readonly agent_launch_count: 0;
    readonly model_gateway_invocation_count: 0;
  };
}

export interface RunRecordedPolicyRollbackD2ProofInputV0 {
  readonly planPolicyRollbackV0: PlanPolicyRollbackV0;
  readonly scenario?: RecordedPolicyRollbackD2ScenarioV0;
}

export interface RecordedPlanIncompleteD2ScenarioV0 {
  readonly schema: typeof PLAN_INCOMPLETE_D2_SCENARIO_SCHEMA_V0;
  readonly v: typeof PLAN_INCOMPLETE_D2_SCENARIO_VERSION_V0;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly last_recompile_at: string;
  readonly last_policy_revalidated_at: string;
  readonly last_unforced_deep_at: string;
  readonly incomplete_plan: CompiledEvidencePlan;
  readonly planned_receipt: ReceiptV0;
  readonly plan_age_receipt: ReceiptV0;
  readonly missing_dependency_receipt: ReceiptV0;
  readonly plan_incomplete_receipt: ReceiptV0;
  readonly deep_roam_discovery: DeepRoamDiscovery;
  readonly policy_artifact: AuthoredPolicyArtifactV0;
  readonly policy_artifact_bytes: string;
  readonly policy_artifact_content_hash: ContentHashV0;
  readonly receipt_history_after_discovery: readonly ReceiptV0[];
}

export interface RecordedPlanIncompleteD2ProofV0 {
  readonly scenario: RecordedPlanIncompleteD2ScenarioV0;
  readonly shallow: Extract<ShallowEvidencePlanResult, { outcome: "ready" }>;
  readonly deep_roam: Extract<DeepRoamReconciliation, { outcome: "force-recompile" }>;
  readonly recompile_request: NormalizedPolicyRecompileDecisionV0;
  readonly gateway_invocations: {
    readonly agent_launch_count: 0;
    readonly model_gateway_invocation_count: 0;
  };
}

export interface RunRecordedPlanIncompleteD2ProofInputV0 {
  readonly planPolicyRecompileV0: PlanPolicyRecompileV0;
  readonly scenario?: RecordedPlanIncompleteD2ScenarioV0;
}

export function makeRecordedPolicyRollbackD2ScenarioV0(): RecordedPolicyRollbackD2ScenarioV0 {
  return {
    schema: POLICY_ROLLBACK_D2_SCENARIO_SCHEMA_V0,
    v: POLICY_ROLLBACK_D2_SCENARIO_VERSION_V0,
    responsibility_id: ROLLBACK_D2_RESPONSIBILITY_ID,
    contract_revision: hashText(
      [
        "kind: responsibility",
        "Goal: The incident channel has a current, accurate briefing.",
        "Criteria: owner, impact, timeline, and next action are current.",
      ].join("\n"),
    ),
    as_of: "2026-05-19T12:00:00.000Z",
    fresh_policy: {
      policy_revision: "policy.d2.fresh-trips-early",
      judged_activations_before_trip: 3,
      activated_at: "2026-05-19T08:00:00.000Z",
      first_trip_at: "2026-05-19T12:00:00.000Z",
    },
    last_known_good_policy: {
      policy_revision: "policy.d2.last-known-good",
      judged_activations_before_trip: 9,
      activated_at: "2026-05-18T11:45:00.000Z",
      first_trip_at: "2026-05-18T12:00:00.000Z",
    },
  };
}

export function assertRecordedPolicyRollbackD2ScenarioV0(
  scenario: RecordedPolicyRollbackD2ScenarioV0,
): void {
  if (scenario.schema !== POLICY_ROLLBACK_D2_SCENARIO_SCHEMA_V0) {
    throw new Error("policy rollback D2 scenario schema is malformed");
  }
  if (scenario.v !== POLICY_ROLLBACK_D2_SCENARIO_VERSION_V0) {
    throw new Error("policy rollback D2 scenario version must be 0");
  }
  if (scenario.responsibility_id.length === 0) {
    throw new Error("policy rollback D2 scenario responsibility_id is required");
  }
  if (!isContentHash(scenario.contract_revision)) {
    throw new Error("policy rollback D2 scenario contract_revision must be a sha256 content hash");
  }
  parseReplayableInstantMs(scenario.as_of, "policy rollback D2 scenario as_of");
  assertTripSummary(scenario.fresh_policy, "fresh_policy");
  assertTripSummary(scenario.last_known_good_policy, "last_known_good_policy");

  if (
    scenario.fresh_policy.judged_activations_before_trip >=
    scenario.last_known_good_policy.judged_activations_before_trip
  ) {
    throw new Error(
      "policy rollback D2 scenario must make the fresh policy trip in fewer judged activations",
    );
  }
}

export async function runRecordedPolicyRollbackD2ProofV0(
  input: RunRecordedPolicyRollbackD2ProofInputV0,
): Promise<RecordedPolicyRollbackD2ProofV0> {
  const scenario = input.scenario ?? makeRecordedPolicyRollbackD2ScenarioV0();
  assertRecordedPolicyRollbackD2ScenarioV0(scenario);

  const decision = normalizePolicyRollbackDecisionV0(
    await input.planPolicyRollbackV0(buildRollbackPlanInput(scenario)),
  );
  assertRollbackDecision(decision, scenario);

  return {
    scenario,
    decision,
    gateway_invocations: {
      agent_launch_count: 0,
      model_gateway_invocation_count: 0,
    },
  };
}

export function createRecordedPolicyRollbackPlannerDoubleV0(): PlanPolicyRollbackV0 {
  return (input: PolicyRollbackPlanInputV0): unknown => {
    assertPositiveSafeInteger(
      input.fresh_policy_judged_activations_before_trip,
      "fresh_policy_judged_activations_before_trip",
    );

    if (
      input.last_known_good_revision === undefined ||
      input.last_known_good_judged_activations_before_trip === undefined
    ) {
      return {
        schema: "openprose.reactor-cradle.rollback-d2-planner-double",
        v: 0,
        outcome: "no-last-known-good",
        fresh_policy_revision: input.fresh_policy_revision,
        fresh_policy_judged_activations_before_trip:
          input.fresh_policy_judged_activations_before_trip,
      };
    }

    assertPositiveSafeInteger(
      input.last_known_good_judged_activations_before_trip,
      "last_known_good_judged_activations_before_trip",
    );
    const outcome: PolicyRollbackDecisionOutcomeV0 =
      input.fresh_policy_judged_activations_before_trip <
      input.last_known_good_judged_activations_before_trip
        ? "rollback"
        : "keep-current";

    return {
      schema: "openprose.reactor-cradle.rollback-d2-planner-double",
      v: 0,
      outcome,
      fresh_policy_revision: input.fresh_policy_revision,
      fresh_policy_judged_activations_before_trip:
        input.fresh_policy_judged_activations_before_trip,
      last_known_good_revision: input.last_known_good_revision,
      last_known_good_judged_activations_before_trip:
        input.last_known_good_judged_activations_before_trip,
      target_policy_revision:
        outcome === "rollback"
          ? input.last_known_good_revision
          : input.fresh_policy_revision,
    };
  };
}

export function normalizePolicyRollbackDecisionV0(
  result: unknown,
): NormalizedPolicyRollbackDecisionV0 {
  if (!isRecord(result)) {
    throw new Error("policy rollback decision must be an object");
  }

  const freshPolicy = readOptionalRecord(result["fresh_policy"]);
  const lastKnownGood = readOptionalRecord(
    result["last_known_good_policy"] ?? result["last_known_good"],
  );
  const outcome = readRollbackOutcome(
    result["outcome"] ?? result["decision"] ?? result["status"] ?? result["kind"],
  );
  const freshPolicyRevision = readNonEmptyString(
    result["fresh_policy_revision"] ?? freshPolicy?.["policy_revision"] ?? freshPolicy?.["revision"],
    "policy rollback fresh_policy_revision",
  );
  const freshTripCount = readSafeInteger(
    result["fresh_policy_judged_activations_before_trip"] ??
      result["fresh_judged_activations_before_trip"] ??
      freshPolicy?.["judged_activations_before_trip"],
    "policy rollback fresh_policy_judged_activations_before_trip",
  );
  const lastKnownGoodRevision = readOptionalNonEmptyString(
    result["last_known_good_revision"] ??
      lastKnownGood?.["policy_revision"] ??
      lastKnownGood?.["revision"],
    "policy rollback last_known_good_revision",
  );
  const lastKnownGoodTripCount = readOptionalSafeInteger(
    result["last_known_good_judged_activations_before_trip"] ??
      result["last_known_good_policy_judged_activations_before_trip"] ??
      lastKnownGood?.["judged_activations_before_trip"],
    "policy rollback last_known_good_judged_activations_before_trip",
  );
  const targetPolicyRevision = readOptionalNonEmptyString(
    result["target_policy_revision"] ??
      result["target_revision"] ??
      result["rollback_target_policy_revision"],
    "policy rollback target_policy_revision",
  );

  return {
    outcome,
    fresh_policy_revision: freshPolicyRevision,
    fresh_policy_judged_activations_before_trip: freshTripCount,
    ...(lastKnownGoodRevision === undefined
      ? {}
      : { last_known_good_revision: lastKnownGoodRevision }),
    ...(lastKnownGoodTripCount === undefined
      ? {}
      : {
          last_known_good_judged_activations_before_trip:
            lastKnownGoodTripCount,
        }),
    ...(targetPolicyRevision === undefined
      ? {}
      : { target_policy_revision: targetPolicyRevision }),
    raw: result,
  };
}

export function makeRecordedPlanIncompleteD2ScenarioV0(): RecordedPlanIncompleteD2ScenarioV0 {
  const contractRevision = hashText(
    [
      "kind: responsibility",
      "Goal: The incident channel has a current, accurate briefing.",
      "Criteria: owner map must be consulted before declaring the next action current.",
    ].join("\n"),
  );
  const responsibilityId = ROLLBACK_D2_RESPONSIBILITY_ID;
  const asOf = "2026-05-19T12:00:00.000Z";
  const plannedReceipt = makeReceipt({
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    source_id: "incident-feed",
    memo_key: "memo:incident-feed",
    as_of: "2026-05-19T11:55:00.000Z",
    next_forecast_recheck: asOf,
    event_cause: "real-input",
    role: "judge",
    evidence_input_ids: [hashText("incident feed says status is green")],
    status: "up",
    fresh: 0,
    reused: 4,
    tags: ["plan-incomplete-d2", "shallow-plan", "incident-feed"],
  });
  const planAgeReceipt = makeReceipt({
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    source_id: "plan-age-clock",
    memo_key: "memo:plan-age-clock",
    as_of: asOf,
    next_forecast_recheck: "2026-05-20T12:00:00.000Z",
    event_cause: "forecast-recheck",
    role: "judge",
    evidence_input_ids: [hashText("plan age clock crossed audit threshold")],
    status: "up",
    fresh: 0,
    reused: 1,
    tags: ["plan-incomplete-d2", "plan-age"],
  });
  const missingDependencyReceipt = makeReceipt({
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    source_id: PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID,
    memo_key: "memo:crm-owner-map",
    as_of: asOf,
    next_forecast_recheck: "2026-05-20T12:00:00.000Z",
    event_cause: "real-input",
    role: "judge",
    evidence_input_ids: [hashText("CRM owner map says owner changed")],
    status: "drifting",
    fresh: 0,
    reused: 1,
    tags: ["plan-incomplete-d2", "deep-roam", PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID],
  });
  const planIncompleteReceipt = makeReceipt({
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    source_id: "plan-incomplete-backstop",
    memo_key: "memo:plan-incomplete-backstop",
    as_of: asOf,
    next_forecast_recheck: asOf,
    event_cause: "escalation",
    role: "judge",
    evidence_input_ids: [missingDependencyReceipt.content_hash],
    status: "blocked",
    blocked_reason: "backstop-divergence",
    fix_target: "policy-artifact",
    fresh: 0,
    reused: 0,
    tags: [
      "plan-incomplete-d2",
      "backstop-divergence",
      "deep-shallow-contradiction",
    ],
  });
  const oldReceiptHistory = [plannedReceipt, planAgeReceipt] as const;
  const policyArtifact = makePlanIncompletePolicyArtifact({
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    receipt_history: oldReceiptHistory,
  });
  const validation = validatePolicyArtifactV0(policyArtifact);
  if (!validation.ok) {
    throw new Error(
      `recorded plan-incomplete D2 policy artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }
  const incompletePlan: CompiledEvidencePlan = {
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    policy_artifact_namespace: policyArtifact.registry_id,
    policy_artifact_revision: policyArtifact.policy_revision,
    plan_revision: "compiled-plan.d2.omits-owner-map",
    as_of: asOf,
    evidence_order: "unordered",
    sources: [
      { id: "incident-feed", kind: "adapter", required: true },
      { id: "plan-age-clock", kind: "forecast", required: true },
    ],
  };

  return {
    schema: PLAN_INCOMPLETE_D2_SCENARIO_SCHEMA_V0,
    v: PLAN_INCOMPLETE_D2_SCENARIO_VERSION_V0,
    responsibility_id: responsibilityId,
    contract_revision: contractRevision,
    as_of: asOf,
    last_recompile_at: "2026-05-19T10:00:00.000Z",
    last_policy_revalidated_at: "2026-05-19T00:00:00.000Z",
    last_unforced_deep_at: asOf,
    incomplete_plan: incompletePlan,
    planned_receipt: plannedReceipt,
    plan_age_receipt: planAgeReceipt,
    missing_dependency_receipt: missingDependencyReceipt,
    plan_incomplete_receipt: planIncompleteReceipt,
    deep_roam_discovery: {
      source_id: PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID,
      kind: "dependency",
      receipt_hash: missingDependencyReceipt.content_hash,
    },
    policy_artifact: policyArtifact,
    policy_artifact_bytes: validation.bytes,
    policy_artifact_content_hash: validation.content_hash,
    receipt_history_after_discovery: [
      plannedReceipt,
      planAgeReceipt,
      missingDependencyReceipt,
      planIncompleteReceipt,
    ],
  };
}

export function assertRecordedPlanIncompleteD2ScenarioV0(
  scenario: RecordedPlanIncompleteD2ScenarioV0,
): void {
  if (scenario.schema !== PLAN_INCOMPLETE_D2_SCENARIO_SCHEMA_V0) {
    throw new Error("plan-incomplete D2 scenario schema is malformed");
  }
  if (scenario.v !== PLAN_INCOMPLETE_D2_SCENARIO_VERSION_V0) {
    throw new Error("plan-incomplete D2 scenario version must be 0");
  }
  if (scenario.responsibility_id.length === 0) {
    throw new Error("plan-incomplete D2 scenario responsibility_id is required");
  }
  if (!isContentHash(scenario.contract_revision)) {
    throw new Error("plan-incomplete D2 scenario contract_revision must be a sha256 content hash");
  }
  parseReplayableInstantMs(scenario.as_of, "plan-incomplete D2 scenario as_of");
  parseReplayableInstantMs(
    scenario.last_recompile_at,
    "plan-incomplete D2 scenario last_recompile_at",
  );
  parseReplayableInstantMs(
    scenario.last_policy_revalidated_at,
    "plan-incomplete D2 scenario last_policy_revalidated_at",
  );
  parseReplayableInstantMs(
    scenario.last_unforced_deep_at,
    "plan-incomplete D2 scenario last_unforced_deep_at",
  );

  for (const [label, receipt] of [
    ["planned_receipt", scenario.planned_receipt],
    ["plan_age_receipt", scenario.plan_age_receipt],
    ["missing_dependency_receipt", scenario.missing_dependency_receipt],
    ["plan_incomplete_receipt", scenario.plan_incomplete_receipt],
  ] as const) {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      throw new Error(`${label} is invalid: ${verification.errors.join("; ")}`);
    }
  }

  const plannedSourceIds = scenario.incomplete_plan.sources.map(
    (source) => source.id,
  );
  if (plannedSourceIds.includes(PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID)) {
    throw new Error("plan-incomplete D2 scenario must omit the missing dependency from the shallow plan");
  }
  if (scenario.deep_roam_discovery.source_id !== PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID) {
    throw new Error("plan-incomplete D2 scenario deep roam discovery must name the missing dependency");
  }
  if (
    scenario.deep_roam_discovery.receipt_hash !==
    scenario.missing_dependency_receipt.content_hash
  ) {
    throw new Error("plan-incomplete D2 discovery must pin the missing dependency receipt");
  }
  if (
    !scenario.plan_incomplete_receipt.cost.tags.includes("backstop-divergence") ||
    scenario.plan_incomplete_receipt.verdict.blocked?.reason !==
      "backstop-divergence"
  ) {
    throw new Error("plan-incomplete D2 scenario must record a backstop-divergence receipt");
  }

  const validation = validatePolicyArtifactV0(scenario.policy_artifact);
  if (!validation.ok) {
    throw new Error(
      `plan-incomplete D2 artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }
  if (validation.bytes !== scenario.policy_artifact_bytes) {
    throw new Error("plan-incomplete D2 artifact bytes are stale");
  }
  if (validation.content_hash !== scenario.policy_artifact_content_hash) {
    throw new Error("plan-incomplete D2 artifact content hash is stale");
  }
  if (
    scenario.policy_artifact.falsification_predicate.kind !==
      "greater-than-or-equal" ||
    scenario.policy_artifact.falsification_predicate.fact !==
      PLAN_INCOMPLETE_D2_BACKSTOP_FACT
  ) {
    throw new Error("plan-incomplete D2 artifact must trip on the deep-roam contradiction fact");
  }
}

export async function runRecordedPlanIncompleteD2ProofV0(
  input: RunRecordedPlanIncompleteD2ProofInputV0,
): Promise<RecordedPlanIncompleteD2ProofV0> {
  const scenario = input.scenario ?? makeRecordedPlanIncompleteD2ScenarioV0();
  assertRecordedPlanIncompleteD2ScenarioV0(scenario);
  const consultedSources: string[] = [];
  const shallow = executeShallowEvidencePlan(scenario.incomplete_plan, {
    "incident-feed": (source) => {
      consultedSources.push(source.id);
      return scenario.planned_receipt;
    },
    "plan-age-clock": (source) => {
      consultedSources.push(source.id);
      return scenario.plan_age_receipt;
    },
    [PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID]: (source) => {
      consultedSources.push(source.id);
      return scenario.missing_dependency_receipt;
    },
  });

  if (shallow.outcome !== "ready") {
    throw new Error(`expected shallow plan to be ready, received ${shallow.outcome}`);
  }
  if (consultedSources.includes(PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID)) {
    throw new Error("shallow execution must not roam to the omitted dependency");
  }

  const deepRoam = reconcileDeepRoam(
    scenario.incomplete_plan,
    "forecast-plan-age",
    [scenario.deep_roam_discovery],
  );
  if (deepRoam.outcome !== "force-recompile") {
    throw new Error(
      `expected deep roam to force recompile, received ${deepRoam.outcome}`,
    );
  }

  const recompileRequest = normalizePolicyRecompileDecisionV0(
    await input.planPolicyRecompileV0(buildPlanIncompleteRecompileInput(scenario)),
  );
  assertPlanIncompleteRecompileRequest(recompileRequest, scenario);

  return {
    scenario,
    shallow,
    deep_roam: deepRoam,
    recompile_request: recompileRequest,
    gateway_invocations: {
      agent_launch_count: 0,
      model_gateway_invocation_count: 0,
    },
  };
}

function buildRollbackPlanInput(
  scenario: RecordedPolicyRollbackD2ScenarioV0,
): PolicyRollbackPlanInputV0 {
  return {
    responsibility_id: scenario.responsibility_id,
    contract_revision: scenario.contract_revision,
    as_of: scenario.as_of,
    fresh_policy_revision: scenario.fresh_policy.policy_revision,
    fresh_policy_judged_activations_before_trip:
      scenario.fresh_policy.judged_activations_before_trip,
    last_known_good_revision: scenario.last_known_good_policy.policy_revision,
    last_known_good_judged_activations_before_trip:
      scenario.last_known_good_policy.judged_activations_before_trip,
    policy_trip_history: [
      scenario.last_known_good_policy,
      scenario.fresh_policy,
    ],
  };
}

function buildPlanIncompleteRecompileInput(
  scenario: RecordedPlanIncompleteD2ScenarioV0,
): Parameters<PlanPolicyRecompileV0>[0] {
  return {
    artifact: scenario.policy_artifact,
    policy_artifact: scenario.policy_artifact,
    receipts: scenario.receipt_history_after_discovery,
    receipt_history: scenario.receipt_history_after_discovery,
    as_of: scenario.as_of,
    last_recompile_at: scenario.last_recompile_at,
    last_policy_recompile_at: scenario.last_recompile_at,
    last_policy_revalidated_at: scenario.last_policy_revalidated_at,
    last_unforced_deep_at: scenario.last_unforced_deep_at,
  };
}

function makePlanIncompletePolicyArtifact(input: {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly receipt_history: readonly ReceiptV0[];
}): AuthoredPolicyArtifactV0 {
  const exploredReceiptHashes = input.receipt_history
    .map((receipt) => receipt.content_hash)
    .sort((left, right) => left.localeCompare(right));
  const historyQuery = {
    schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    selected_receipt_hashes: exploredReceiptHashes,
    rationale:
      "recorded D2 plan-incomplete proof pins the shallow plan history before deep roam",
  };

  return {
    schema: POLICY_ARTIFACT_SCHEMA,
    v: POLICY_ARTIFACT_VERSION,
    responsibility_id: input.responsibility_id,
    registry_id: "registry.incident-channel-current-briefing.d2",
    policy_revision: "policy.d2.plan-incomplete-before-roam",
    no_anchor: true,
    live_observables: PLAN_INCOMPLETE_LIVE_OBSERVABLES,
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
      backstop_deep_contradiction_count: 1,
      stale_brief_minutes: 30,
      fresh_tokens_per_day_ceiling: 500,
    },
    transitive_freshness_function: { kind: "kernel-default" },
    falsification_predicate: {
      kind: "greater-than-or-equal",
      fact: PLAN_INCOMPLETE_D2_BACKSTOP_FACT,
      value: 1,
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: PLAN_INCOMPLETE_D2_BACKSTOP_FACT,
      value: 1,
    },
    provenance: {
      contract_revision: input.contract_revision,
      receipt_history_summary_hash: hashReceiptHistorySummary(input.receipt_history),
      explored_receipt_hashes: exploredReceiptHashes,
      history_query: historyQuery,
    },
  };
}

const PLAN_INCOMPLETE_LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: PLAN_INCOMPLETE_D2_BACKSTOP_FACT,
    source: "kernel-backstop",
    description: "deep roaming discovered a dependency outside the compiled evidence plan",
  },
  {
    id: "cost.fresh_tokens_per_maintained_day",
    source: "cost-ledger",
    description: "fresh maintenance tokens per maintained day from receipt cost facts",
  },
];

function makeReceipt(input: {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly source_id: string;
  readonly memo_key: string;
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly event_cause: ReceiptEventCauseV0;
  readonly role: ReceiptRoleV0;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly status: "up" | "drifting" | "down" | "blocked";
  readonly blocked_reason?: string;
  readonly fix_target?: string;
  readonly fresh: number;
  readonly reused: number;
  readonly tags: readonly string[];
}): ReceiptV0 {
  return createReceiptV0({
    core: {
      responsibility_id: input.responsibility_id,
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
      null_reason: "cradle recorded D2 rollback and plan-incomplete proof",
    },
    verdict: {
      status: input.status,
      confidence: {
        value: input.status === "blocked" ? 0 : 0.82,
        derivation_method: "recorded-cradle-d2-fixture",
        calibration_grade: "none",
        label_source: "none",
      },
      ...(input.status === "blocked"
        ? {
            blocked: {
              reason: input.blocked_reason ?? "plan-incomplete",
              fix_target: input.fix_target ?? "policy-artifact",
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
      model: "recorded-d2-fixture",
      role: input.role,
      tags: input.tags,
      responsibility_id: input.responsibility_id,
      run_id: "rollback-d2-recorded",
      as_of: input.as_of,
      tokens: {
        fresh: input.fresh,
        reused: input.reused,
      },
      surprise_cause: input.event_cause,
    },
  });
}

function assertRollbackDecision(
  decision: NormalizedPolicyRollbackDecisionV0,
  scenario: RecordedPolicyRollbackD2ScenarioV0,
): void {
  if (decision.outcome !== "rollback") {
    throw new Error(`expected rollback decision, received ${decision.outcome}`);
  }
  if (decision.fresh_policy_revision !== scenario.fresh_policy.policy_revision) {
    throw new Error("rollback decision named the wrong fresh policy revision");
  }
  if (
    decision.last_known_good_revision !==
    scenario.last_known_good_policy.policy_revision
  ) {
    throw new Error("rollback decision must name the last-known-good policy");
  }
  if (
    decision.fresh_policy_judged_activations_before_trip !==
    scenario.fresh_policy.judged_activations_before_trip
  ) {
    throw new Error("rollback decision changed the fresh judged activation count");
  }
  if (
    decision.last_known_good_judged_activations_before_trip !==
    scenario.last_known_good_policy.judged_activations_before_trip
  ) {
    throw new Error("rollback decision changed the last-known-good judged activation count");
  }
  if (
    decision.target_policy_revision !== undefined &&
    decision.target_policy_revision !== scenario.last_known_good_policy.policy_revision
  ) {
    throw new Error("rollback decision target must be the last-known-good policy");
  }
}

function assertPlanIncompleteRecompileRequest(
  decision: NormalizedPolicyRecompileDecisionV0,
  scenario: RecordedPlanIncompleteD2ScenarioV0,
): void {
  if (decision.outcome !== "recompile-requested") {
    throw new Error(
      `expected plan-incomplete proof to route to recompile-requested, received ${decision.outcome}`,
    );
  }
  if (
    decision.drift_outcome !== undefined &&
    decision.drift_outcome !== "tripped"
  ) {
    throw new Error(
      `plan-incomplete P3 route must preserve tripped drift evidence, received ${decision.drift_outcome}`,
    );
  }
  if (
    !decision.evidence_receipt_hashes.includes(
      scenario.plan_incomplete_receipt.content_hash,
    )
  ) {
    throw new Error("plan-incomplete P3 route must cite the backstop-divergence receipt");
  }
}

function assertTripSummary(
  summary: RecordedPolicyTripSummaryV0,
  label: string,
): void {
  if (summary.policy_revision.length === 0) {
    throw new Error(`${label}.policy_revision must be non-empty`);
  }
  assertPositiveSafeInteger(
    summary.judged_activations_before_trip,
    `${label}.judged_activations_before_trip`,
  );
  parseReplayableInstantMs(summary.activated_at, `${label}.activated_at`);
  parseReplayableInstantMs(summary.first_trip_at, `${label}.first_trip_at`);
  if (
    parseReplayableInstantMs(summary.first_trip_at, `${label}.first_trip_at`) <
    parseReplayableInstantMs(summary.activated_at, `${label}.activated_at`)
  ) {
    throw new Error(`${label}.first_trip_at must not precede activated_at`);
  }
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
        tags: receipt.cost.tags,
      })),
    ),
  );
}

function readRollbackOutcome(value: unknown): PolicyRollbackDecisionOutcomeV0 {
  if (
    value === "rollback" ||
    value === "keep-current" ||
    value === "no-last-known-good"
  ) {
    return value;
  }

  throw new Error(
    "policy rollback decision outcome must be rollback, keep-current, or no-last-known-good",
  );
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function readOptionalNonEmptyString(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readNonEmptyString(value, label);
}

function readSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }

  return value as number;
}

function readOptionalSafeInteger(
  value: unknown,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readSafeInteger(value, label);
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function parseReplayableInstantMs(value: string, label: string): number {
  const ms = Date.parse(value);
  if (
    Number.isNaN(ms) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    throw new Error(`${label} must be a replayable ISO instant`);
  }

  return ms;
}

function hashText(value: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isContentHash(value: string): value is ContentHashV0 {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function readOptionalRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadReactorEvidencePlan(): ReactorEvidencePlanModule {
  try {
    return require("@openprose/reactor/evidence-plan") as ReactorEvidencePlanModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/evidence-plan")) {
      return require("../../../reactor/dist/evidence-plan") as ReactorEvidencePlanModule;
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

function isMissingReactorSubpath(error: unknown, subpath: string): boolean {
  return (
    isRecord(error) &&
    error["code"] === "MODULE_NOT_FOUND" &&
    typeof error["message"] === "string" &&
    error["message"].includes(subpath)
  );
}
