import { createHash } from "node:crypto";

import type {
  AuthoredPolicyArtifactV0,
  PolicyLiveObservableV0,
} from "@openprose/reactor/policy";
import type { ContentHashV0, ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
  ReactorAgentSdkAdapterV0,
  ReactorModelGatewayAdapterV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorRegistrySnapshotV0,
} from "@openprose/reactor/sdk";

import {
  POLICY_DRIFT_P2_BACKSTOP_FACT,
  POLICY_DRIFT_P2_COST_FACT,
  type RecordedPolicyDriftP2ScenarioV0,
  makeRecordedPolicyDriftP2ScenarioV0,
} from "../policy-drift";

type ReactorPolicyModule = typeof import("@openprose/reactor/policy");

const {
  canonicalizePolicyArtifactV0,
  validatePolicyArtifactV0,
} = loadReactorPolicy();

export const POLICY_RECOMPILE_D1_SCENARIO_SCHEMA_V0 =
  "openprose.reactor-cradle.recompile-d1-scenario" as const;
export const POLICY_RECOMPILE_D1_SCENARIO_VERSION_V0 = 0 as const;
export const POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_SCHEMA_V0 =
  "openprose.reactor-cradle.recompile-d1-author-cassette" as const;
export const POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_VERSION_V0 = 0 as const;

export type PolicyRecompileDecisionOutcomeV0 =
  | "no-recompile-needed"
  | "recompile-requested"
  | "recompile-delayed"
  | "needs-judgment";

export type PlanPolicyRecompileV0 = (
  input: PolicyRecompilePlanInputV0,
) => Promise<unknown> | unknown;

export type ExecutePolicyRecompileV0 = (
  input: PolicyRecompileExecutionInputV0,
) => Promise<unknown> | unknown;

export type PolicyRecompileAuthorV0 = (
  input: unknown,
) => Promise<ReactorRegistrySnapshotV0> | ReactorRegistrySnapshotV0;

export interface RecordedPolicyRecompileD1ScenarioV0 {
  readonly schema: typeof POLICY_RECOMPILE_D1_SCENARIO_SCHEMA_V0;
  readonly v: typeof POLICY_RECOMPILE_D1_SCENARIO_VERSION_V0;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly as_of: string;
  readonly last_recompile_at_allowed: string;
  readonly last_recompile_at_blocked: string;
  readonly min_recompile_interval_ms: number;
  readonly receipt_history: readonly ReceiptV0[];
  readonly policy_artifact: AuthoredPolicyArtifactV0;
  readonly policy_artifact_bytes: string;
  readonly policy_artifact_content_hash: ContentHashV0;
  readonly recompiled_registry_snapshot: ReactorRegistrySnapshotV0;
  readonly drift_scenario: RecordedPolicyDriftP2ScenarioV0;
}

export interface PolicyRecompilePlanInputV0 {
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly policy_artifact: AuthoredPolicyArtifactV0;
  readonly receipts: readonly ReceiptV0[];
  readonly receipt_history: readonly ReceiptV0[];
  readonly as_of: string;
  readonly last_recompile_at: string | null;
  readonly last_policy_recompile_at: string | null;
  readonly last_policy_revalidated_at: string;
  readonly last_unforced_deep_at: string;
}

export interface PolicyRecompileExecutionInputV0 {
  readonly decision: unknown;
  readonly plan: unknown;
  readonly recompile_decision: unknown;
  readonly normalized_decision: NormalizedPolicyRecompileDecisionV0;
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly policy_artifact: AuthoredPolicyArtifactV0;
  readonly receipts: readonly ReceiptV0[];
  readonly receipt_history: readonly ReceiptV0[];
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly as_of: string;
  readonly last_recompile_at: string | null;
  readonly last_policy_recompile_at: string | null;
  readonly policy_artifact_namespace: string;
  readonly authorPolicyArtifactV0: PolicyRecompileAuthorV0;
  readonly author_policy_artifact_v0: PolicyRecompileAuthorV0;
  readonly author_input: {
    readonly responsibility_id: string;
    readonly contract_revision: ContentHashV0;
    readonly contract_summary: string;
    readonly no_anchor: boolean;
    readonly live_observables: readonly PolicyLiveObservableV0[];
    readonly receipt_history: readonly ReceiptV0[];
    readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
    readonly policy_artifact_namespace: string;
  };
  readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly agent_sdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly model_gateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
}

export interface NormalizedPolicyRecompileDecisionV0 {
  readonly outcome: PolicyRecompileDecisionOutcomeV0;
  readonly drift_outcome?: "not-tripped" | "tripped" | "indeterminate";
  readonly evidence_receipt_hashes: readonly ContentHashV0[];
  readonly raw: unknown;
}

export interface NormalizedPolicyRecompileExecutionV0 {
  readonly outcome: "recompiled" | "skipped" | "unknown";
  readonly registry_snapshot?: ReactorRegistrySnapshotV0;
  readonly raw: unknown;
}

export interface RecordedPolicyRecompileAuthorInvocationV0 {
  readonly input: unknown;
  readonly input_canonical: string;
  readonly input_hash: ContentHashV0;
  readonly output: ReactorRegistrySnapshotV0;
  readonly output_canonical: string;
  readonly output_hash: ContentHashV0;
}

export interface RecordedPolicyRecompileAuthorAgentExchangeV0 {
  readonly request: unknown;
  readonly request_canonical: string;
  readonly request_hash: ContentHashV0;
  readonly response: unknown;
  readonly response_canonical: string;
  readonly response_hash: ContentHashV0;
}

export interface RecordedPolicyRecompileAuthorCassetteV0 {
  readonly schema: typeof POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_SCHEMA_V0;
  readonly v: typeof POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_VERSION_V0;
  readonly invocations: readonly RecordedPolicyRecompileAuthorInvocationV0[];
  readonly agent_exchanges: readonly RecordedPolicyRecompileAuthorAgentExchangeV0[];
  readonly author_session_count: number;
}

export interface RecordedPolicyRecompileAuthorDoubleV0 {
  readonly authorPolicyArtifactV0: PolicyRecompileAuthorV0;
  readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly cassette: RecordedPolicyRecompileAuthorCassetteV0;
  readonly invocation_count: number;
  readonly assertInvokedExactly: (expected: number) => void;
}

export interface PolicyRecompileGatewayProbeV0 {
  readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly agent_sdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly model_gateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly agent_launch_count: number;
  readonly model_gateway_invocation_count: number;
  readonly assertNoInvocations: () => void;
}

export interface RecordedPolicyRecompileD1ProofV0 {
  readonly scenario: RecordedPolicyRecompileD1ScenarioV0;
  readonly requested: NormalizedPolicyRecompileDecisionV0;
  readonly delayed: NormalizedPolicyRecompileDecisionV0;
  readonly requested_execution: NormalizedPolicyRecompileExecutionV0;
  readonly delayed_execution: NormalizedPolicyRecompileExecutionV0;
  readonly requested_author_cassette: RecordedPolicyRecompileAuthorCassetteV0;
  readonly delayed_author_cassette: RecordedPolicyRecompileAuthorCassetteV0;
  readonly requested_policy_author_invocation_count: 1;
  readonly delayed_policy_author_invocation_count: 0;
  readonly gateway_invocations: {
    readonly requested: {
      readonly agent_launch_count: 0;
      readonly model_gateway_invocation_count: 0;
    };
    readonly delayed: {
      readonly agent_launch_count: 0;
      readonly model_gateway_invocation_count: 0;
    };
  };
}

export interface RunRecordedPolicyRecompileD1ProofInputV0 {
  readonly planPolicyRecompileV0: PlanPolicyRecompileV0;
  readonly executePolicyRecompileV0: ExecutePolicyRecompileV0;
  readonly scenario?: RecordedPolicyRecompileD1ScenarioV0;
}

export function makeRecordedPolicyRecompileD1ScenarioV0(): RecordedPolicyRecompileD1ScenarioV0 {
  const driftScenario = makeRecordedPolicyDriftP2ScenarioV0();
  const policyArtifact = driftScenario.cost_drift_artifact;
  const validation = validatePolicyArtifactV0(policyArtifact);
  if (!validation.ok) {
    throw new Error(
      `recorded D1 policy artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }

  return {
    schema: POLICY_RECOMPILE_D1_SCENARIO_SCHEMA_V0,
    v: POLICY_RECOMPILE_D1_SCENARIO_VERSION_V0,
    responsibility_id: driftScenario.responsibility_id,
    contract_revision: driftScenario.contract_revision,
    contract_summary: [
      "kind: responsibility",
      "Goal: The incident channel has a current, accurate briefing.",
      "Criteria: impact, timeline, owner, next action, and customer-facing status are current.",
    ].join("\n"),
    as_of: driftScenario.as_of,
    last_recompile_at_allowed: "2026-05-18T22:30:00.000Z",
    last_recompile_at_blocked: "2026-05-18T23:30:00.000Z",
    min_recompile_interval_ms: policyArtifact.hysteresis.min_recompile_interval_ms,
    receipt_history: driftScenario.receipt_history,
    policy_artifact: policyArtifact,
    policy_artifact_bytes: validation.bytes,
    policy_artifact_content_hash: validation.content_hash,
    recompiled_registry_snapshot: makeRecompiledRegistrySnapshotV0(
      policyArtifact,
      driftScenario.receipt_history,
    ),
    drift_scenario: driftScenario,
  };
}

export function assertRecordedPolicyRecompileD1ScenarioV0(
  scenario: RecordedPolicyRecompileD1ScenarioV0,
): void {
  if (scenario.schema !== POLICY_RECOMPILE_D1_SCENARIO_SCHEMA_V0) {
    throw new Error("policy recompile D1 scenario schema is malformed");
  }
  if (scenario.v !== POLICY_RECOMPILE_D1_SCENARIO_VERSION_V0) {
    throw new Error("policy recompile D1 scenario version must be 0");
  }
  if (scenario.receipt_history.length === 0) {
    throw new Error("policy recompile D1 scenario must include receipt history");
  }
  if (
    scenario.min_recompile_interval_ms !==
    scenario.policy_artifact.hysteresis.min_recompile_interval_ms
  ) {
    throw new Error(
      "policy recompile D1 scenario min interval must match artifact hysteresis",
    );
  }
  assertRecompileIntervalVariant(
    scenario,
    scenario.last_recompile_at_allowed,
    "allowed",
  );
  assertRecompileIntervalVariant(
    scenario,
    scenario.last_recompile_at_blocked,
    "blocked",
  );

  if (
    scenario.policy_artifact.falsification_predicate.kind !==
      "greater-than-or-equal" ||
    scenario.policy_artifact.falsification_predicate.fact !==
      POLICY_DRIFT_P2_COST_FACT
  ) {
    throw new Error("policy recompile D1 scenario must use the P2 cost trip");
  }

  const validation = validatePolicyArtifactV0(scenario.policy_artifact);
  if (!validation.ok) {
    throw new Error(
      `policy recompile D1 artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }
  if (validation.bytes !== scenario.policy_artifact_bytes) {
    throw new Error("policy recompile D1 artifact bytes are stale");
  }
  if (validation.content_hash !== scenario.policy_artifact_content_hash) {
    throw new Error("policy recompile D1 artifact content hash is stale");
  }
  assertRegistrySnapshotMatchesScenario(
    scenario.recompiled_registry_snapshot,
    scenario,
  );
}

export function createRecordedPolicyRecompileAuthorDoubleV0(
  scenario: RecordedPolicyRecompileD1ScenarioV0,
): RecordedPolicyRecompileAuthorDoubleV0 {
  assertRecordedPolicyRecompileD1ScenarioV0(scenario);
  const invocations: RecordedPolicyRecompileAuthorInvocationV0[] = [];
  const agentExchanges: RecordedPolicyRecompileAuthorAgentExchangeV0[] = [];
  const recompiledArtifact = readRecompiledArtifactFromScenario(scenario);

  const authorPolicyArtifactV0: PolicyRecompileAuthorV0 = (input: unknown) => {
    assertPolicyAuthorInputMatchesScenario(input, scenario);
    const inputSnapshot = createCanonicalSnapshot(
      sanitizeForCanonical(input),
      "policy recompile author input",
    );
    const outputSnapshot = createCanonicalSnapshot(
      scenario.recompiled_registry_snapshot,
      "policy recompile author output",
    );

    invocations.push({
      input: inputSnapshot.value,
      input_canonical: inputSnapshot.canonical,
      input_hash: inputSnapshot.hash,
      output: outputSnapshot.value as ReactorRegistrySnapshotV0,
      output_canonical: outputSnapshot.canonical,
      output_hash: outputSnapshot.hash,
    });

    return cloneFromCanonical(outputSnapshot) as ReactorRegistrySnapshotV0;
  };
  const agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch"> = {
    launch(request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
      if (request.kind !== "policy-author") {
        throw new Error("policy recompile author double only handles policy-author launches");
      }
      const requestSnapshot = createCanonicalSnapshot(
        sanitizeForCanonical(request),
        "policy recompile author agent request",
      );
      const exchangeIndex = agentExchanges.length;
      const response =
        exchangeIndex === 0
          ? {
              payload: recompiledArtifact.provenance.history_query,
            }
          : exchangeIndex === 1
            ? {
                payload: {
                  schema: "openprose.reactor.policy-author.artifact-response",
                  v: 0,
                  artifact: recompiledArtifact,
                },
              }
            : undefined;

      if (response === undefined) {
        throw new Error(
          `unexpected policy recompile author launch ${exchangeIndex}`,
        );
      }

      const responseSnapshot = createCanonicalSnapshot(
        response,
        "policy recompile author agent response",
      );
      agentExchanges.push({
        request: requestSnapshot.value,
        request_canonical: requestSnapshot.canonical,
        request_hash: requestSnapshot.hash,
        response: responseSnapshot.value,
        response_canonical: responseSnapshot.canonical,
        response_hash: responseSnapshot.hash,
      });

      return cloneFromCanonical(responseSnapshot) as ReactorAgentResponseV0;
    },
  };

  return {
    authorPolicyArtifactV0,
    agentSdk,
    get cassette(): RecordedPolicyRecompileAuthorCassetteV0 {
      return {
        schema: POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_SCHEMA_V0,
        v: POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_VERSION_V0,
        invocations: invocations.map((invocation) => ({ ...invocation })),
        agent_exchanges: agentExchanges.map((exchange) => ({ ...exchange })),
        author_session_count: countAuthorSessions(invocations, agentExchanges),
      };
    },
    get invocation_count(): number {
      return countAuthorSessions(invocations, agentExchanges);
    },
    assertInvokedExactly(expected: number): void {
      const actual = countAuthorSessions(invocations, agentExchanges);
      if (actual !== expected) {
        throw new Error(
          `expected policy recompile author to be invoked ${expected} time(s), received ${actual}`,
        );
      }
    },
  };
}

export function createPolicyRecompileGatewayProbeV0(): PolicyRecompileGatewayProbeV0 {
  let agentLaunchCount = 0;
  let modelGatewayInvocationCount = 0;

  const agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch"> = {
    launch(_request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
      agentLaunchCount += 1;
      throw new Error("policy recompile D1 proof must not launch agent SDK directly");
    },
  };
  const modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke"> = {
    invoke(_request: ReactorModelGatewayRequestV0): ReactorModelGatewayResponseV0 {
      modelGatewayInvocationCount += 1;
      throw new Error("policy recompile D1 proof must not call model gateway");
    },
  };

  return {
    agentSdk,
    agent_sdk: agentSdk,
    modelGateway,
    model_gateway: modelGateway,
    get agent_launch_count(): number {
      return agentLaunchCount;
    },
    get model_gateway_invocation_count(): number {
      return modelGatewayInvocationCount;
    },
    assertNoInvocations(): void {
      if (agentLaunchCount !== 0 || modelGatewayInvocationCount !== 0) {
        throw new Error(
          `policy recompile D1 proof invoked forbidden inference gateways: agent=${agentLaunchCount}, model=${modelGatewayInvocationCount}`,
        );
      }
    },
  };
}

export async function runRecordedPolicyRecompileD1ProofV0(
  input: RunRecordedPolicyRecompileD1ProofInputV0,
): Promise<RecordedPolicyRecompileD1ProofV0> {
  const scenario = input.scenario ?? makeRecordedPolicyRecompileD1ScenarioV0();
  assertRecordedPolicyRecompileD1ScenarioV0(scenario);

  const requested = normalizePolicyRecompileDecisionV0(
    await input.planPolicyRecompileV0(
      buildPlanInput(scenario, scenario.last_recompile_at_allowed),
    ),
  );
  assertRecompileDecision(requested, "recompile-requested", scenario);

  const requestedAuthor = createRecordedPolicyRecompileAuthorDoubleV0(scenario);
  const requestedProbe = createPolicyRecompileGatewayProbeV0();
  const requestedExecution = normalizePolicyRecompileExecutionV0(
    await input.executePolicyRecompileV0(
      buildExecutionInput(
        scenario,
        requested,
        scenario.last_recompile_at_allowed,
        requestedAuthor,
        requestedProbe,
      ),
    ),
    requested,
    requestedAuthor.invocation_count,
  );
  requestedAuthor.assertInvokedExactly(1);
  requestedProbe.assertNoInvocations();
  assertRegistrySnapshotMatchesScenario(
    requestedExecution.registry_snapshot ?? scenario.recompiled_registry_snapshot,
    scenario,
  );

  const delayed = normalizePolicyRecompileDecisionV0(
    await input.planPolicyRecompileV0(
      buildPlanInput(scenario, scenario.last_recompile_at_blocked),
    ),
  );
  assertRecompileDecision(delayed, "recompile-delayed", scenario);

  const delayedAuthor = createRecordedPolicyRecompileAuthorDoubleV0(scenario);
  const delayedProbe = createPolicyRecompileGatewayProbeV0();
  const delayedExecution = normalizePolicyRecompileExecutionV0(
    await input.executePolicyRecompileV0(
      buildExecutionInput(
        scenario,
        delayed,
        scenario.last_recompile_at_blocked,
        delayedAuthor,
        delayedProbe,
      ),
    ),
    delayed,
    delayedAuthor.invocation_count,
  );
  delayedAuthor.assertInvokedExactly(0);
  delayedProbe.assertNoInvocations();

  return {
    scenario,
    requested,
    delayed,
    requested_execution: requestedExecution,
    delayed_execution: delayedExecution,
    requested_author_cassette: requestedAuthor.cassette,
    delayed_author_cassette: delayedAuthor.cassette,
    requested_policy_author_invocation_count: 1,
    delayed_policy_author_invocation_count: 0,
    gateway_invocations: {
      requested: {
        agent_launch_count: 0,
        model_gateway_invocation_count: 0,
      },
      delayed: {
        agent_launch_count: 0,
        model_gateway_invocation_count: 0,
      },
    },
  };
}

export function normalizePolicyRecompileDecisionV0(
  result: unknown,
): NormalizedPolicyRecompileDecisionV0 {
  if (!isRecord(result)) {
    throw new Error("policy recompile decision must be an object");
  }

  const outcome = readRecompileOutcome(
    result["outcome"] ?? result["decision"] ?? result["status"] ?? result["kind"],
  );
  const driftRecord = readOptionalRecord(
    result["drift_evaluation"] ??
      result["policy_drift"] ??
      result["drift"] ??
      result["trigger"] ??
      result["trigger_evaluation"],
  );
  const driftOutcome =
    driftRecord === undefined
      ? undefined
      : readOptionalDriftOutcome(
          driftRecord["outcome"] ??
            driftRecord["status"] ??
            driftRecord["decision"] ??
            driftRecord["kind"],
        );
  const evidenceReceiptHashes = readContentHashArrayFromUnknown(
    result["evidence_receipt_hashes"] ??
      result["evidence_hashes"] ??
      result["receipt_hashes"] ??
      driftRecord?.["evidence_receipt_hashes"] ??
      driftRecord?.["evidence_hashes"] ??
      [],
    "policy recompile evidence receipt hashes",
  );

  return {
    outcome,
    ...(driftOutcome === undefined ? {} : { drift_outcome: driftOutcome }),
    evidence_receipt_hashes: evidenceReceiptHashes,
    raw: result,
  };
}

export function normalizePolicyRecompileExecutionV0(
  result: unknown,
  decision: NormalizedPolicyRecompileDecisionV0,
  authorInvocationCount: number,
): NormalizedPolicyRecompileExecutionV0 {
  const resultRecord = isRecord(result) ? result : undefined;
  const registrySnapshot = readOptionalRegistrySnapshot(
    resultRecord?.["registry_snapshot"] ??
      resultRecord?.["registry"] ??
      resultRecord?.["snapshot"] ??
      resultRecord?.["policy_registry_snapshot"],
  );
  const rawOutcome = resultRecord?.["outcome"] ?? resultRecord?.["status"];
  const outcome =
    rawOutcome === "recompiled" ||
    rawOutcome === "policy-recompiled" ||
    rawOutcome === "recompile-authored" ||
    rawOutcome === "executed"
      ? "recompiled"
      : rawOutcome === "skipped" ||
          rawOutcome === "noop" ||
          rawOutcome === "no-op" ||
          rawOutcome === "recompile-delayed"
        ? "skipped"
        : decision.outcome === "recompile-requested" && authorInvocationCount === 1
          ? "recompiled"
          : decision.outcome !== "recompile-requested" && authorInvocationCount === 0
            ? "skipped"
            : "unknown";

  return {
    outcome,
    ...(registrySnapshot === undefined ? {} : { registry_snapshot: registrySnapshot }),
    raw: result,
  };
}

export function createRecordedPolicyRecompilePlannerDoubleV0(): PlanPolicyRecompileV0 {
  return (input: PolicyRecompilePlanInputV0): unknown => {
    const lastRecompileAt = input.last_recompile_at;
    if (lastRecompileAt === null) {
      throw new Error("recorded D1 planner double requires last_recompile_at");
    }
    const intervalMs = input.artifact.hysteresis.min_recompile_interval_ms;
    const elapsedMs =
      parseReplayableInstantMs(input.as_of, "as_of") -
      parseReplayableInstantMs(lastRecompileAt, "last_recompile_at");
    const outcome: PolicyRecompileDecisionOutcomeV0 =
      elapsedMs >= intervalMs ? "recompile-requested" : "recompile-delayed";

    return {
      schema: "openprose.reactor-cradle.recompile-d1-planner-double",
      v: 0,
      outcome,
      reason:
        outcome === "recompile-requested"
          ? "policy drift predicate tripped and min interval elapsed"
          : "policy drift predicate tripped but min interval has not elapsed",
      as_of: input.as_of,
      last_recompile_at: lastRecompileAt,
      min_recompile_interval_ms: intervalMs,
      evidence_receipt_hashes: input.receipt_history.map(
        (receipt) => receipt.content_hash,
      ),
      drift_evaluation: {
        outcome: "tripped",
        facts: {
          [POLICY_DRIFT_P2_COST_FACT]: 1725,
          [POLICY_DRIFT_P2_BACKSTOP_FACT]: 0,
          "receipt.escalation_precision_7d": 0.5,
        },
        predicate: {
          outcome: "tripped",
        },
        evidence_receipt_hashes: input.receipt_history.map(
          (receipt) => receipt.content_hash,
        ),
      },
    };
  };
}

export function createRecordedPolicyRecompileExecutorDoubleV0(): ExecutePolicyRecompileV0 {
  return async (input: PolicyRecompileExecutionInputV0): Promise<unknown> => {
    const decision = normalizePolicyRecompileDecisionV0(input.decision);
    if (decision.outcome !== "recompile-requested") {
      return {
        schema: "openprose.reactor-cradle.recompile-d1-executor-double",
        v: 0,
        outcome: "skipped",
        skipped_reason: decision.outcome,
        decision: input.decision,
      };
    }

    const snapshot = await input.authorPolicyArtifactV0({
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      contract_summary: input.contract_summary,
      no_anchor: input.no_anchor,
      live_observables: input.live_observables,
      receipt_history: input.receipt_history,
      receipts: input.receipt_history,
      as_of: input.as_of,
      policy_artifact_namespace: input.policy_artifact_namespace,
      trigger_decision: input.decision,
    });

    return {
      schema: "openprose.reactor-cradle.recompile-d1-executor-double",
      v: 0,
      outcome: "recompiled",
      decision: input.decision,
      registry_snapshot: snapshot,
    };
  };
}

function buildPlanInput(
  scenario: RecordedPolicyRecompileD1ScenarioV0,
  lastRecompileAt: string | null,
): PolicyRecompilePlanInputV0 {
  return {
    artifact: scenario.policy_artifact,
    policy_artifact: scenario.policy_artifact,
    receipts: scenario.receipt_history,
    receipt_history: scenario.receipt_history,
    as_of: scenario.as_of,
    last_recompile_at: lastRecompileAt,
    last_policy_recompile_at: lastRecompileAt,
    last_policy_revalidated_at: lastRecompileAt ?? scenario.as_of,
    last_unforced_deep_at: lastRecompileAt ?? scenario.as_of,
  };
}

function buildExecutionInput(
  scenario: RecordedPolicyRecompileD1ScenarioV0,
  decision: NormalizedPolicyRecompileDecisionV0,
  lastRecompileAt: string | null,
  authorDouble: RecordedPolicyRecompileAuthorDoubleV0,
  gatewayProbe: PolicyRecompileGatewayProbeV0,
): PolicyRecompileExecutionInputV0 {
  return {
    decision: decision.raw,
    plan: decision.raw,
    recompile_decision: decision.raw,
    normalized_decision: decision,
    artifact: scenario.policy_artifact,
    policy_artifact: scenario.policy_artifact,
    receipts: scenario.receipt_history,
    receipt_history: scenario.receipt_history,
    responsibility_id: scenario.responsibility_id,
    contract_revision: scenario.contract_revision,
    contract_summary: scenario.contract_summary,
    no_anchor: scenario.policy_artifact.no_anchor,
    live_observables: scenario.policy_artifact.live_observables,
    as_of: scenario.as_of,
    last_recompile_at: lastRecompileAt,
    last_policy_recompile_at: lastRecompileAt,
    policy_artifact_namespace: scenario.policy_artifact.registry_id,
    authorPolicyArtifactV0: authorDouble.authorPolicyArtifactV0,
    author_policy_artifact_v0: authorDouble.authorPolicyArtifactV0,
    author_input: {
      responsibility_id: scenario.responsibility_id,
      contract_revision: scenario.contract_revision,
      contract_summary: scenario.contract_summary,
      no_anchor: scenario.policy_artifact.no_anchor,
      live_observables: scenario.policy_artifact.live_observables,
      receipt_history: scenario.receipt_history,
      agentSdk: authorDouble.agentSdk,
      policy_artifact_namespace: scenario.policy_artifact.registry_id,
    },
    agentSdk: gatewayProbe.agentSdk,
    agent_sdk: gatewayProbe.agent_sdk,
    modelGateway: gatewayProbe.modelGateway,
    model_gateway: gatewayProbe.model_gateway,
  };
}

function makeRecompiledRegistrySnapshotV0(
  previousArtifact: AuthoredPolicyArtifactV0,
  receiptHistory: readonly ReceiptV0[],
): ReactorRegistrySnapshotV0 {
  const historyQuery = {
    schema: "openprose.reactor.policy-author.history-query" as const,
    v: 0 as const,
    selected_receipt_hashes: previousArtifact.provenance.explored_receipt_hashes,
    rationale:
      "recorded D1 proof selects the same tripping receipt slice before authoring",
  };
  const nextArtifact: AuthoredPolicyArtifactV0 = {
    ...previousArtifact,
    policy_revision: `${previousArtifact.policy_revision}.d1-recompiled`,
    provenance: {
      contract_revision: previousArtifact.provenance.contract_revision,
      receipt_history_summary_hash: hashPolicyAuthorReceiptHistorySummary(
        receiptHistory,
      ),
      explored_receipt_hashes: previousArtifact.provenance.explored_receipt_hashes,
      history_query: historyQuery,
    },
  };
  const validation = validatePolicyArtifactV0(nextArtifact);
  if (!validation.ok) {
    throw new Error(
      `recorded D1 recompiled artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }

  const validationState = {
    status: "validated" as const,
    validator_id: "openprose.reactor-cradle.recompile-d1-recorded-author",
  };

  return {
    contract_revision: validation.artifact.provenance.contract_revision,
    policy_artifact_id: validation.artifact.registry_id,
    policy_artifact_identity: validation.artifact.registry_id,
    policy_artifact_namespace: validation.artifact.registry_id,
    policy_artifact_revision: validation.artifact.policy_revision,
    policy_artifact_validation_state: validationState,
    validation_state: validationState,
    policy_artifact_bytes: canonicalizePolicyArtifactV0(validation.artifact),
    policy_artifact_content_hash: validation.content_hash,
  };
}

function readRecompiledArtifactFromScenario(
  scenario: RecordedPolicyRecompileD1ScenarioV0,
): AuthoredPolicyArtifactV0 {
  const bytes = scenario.recompiled_registry_snapshot.policy_artifact_bytes;
  if (typeof bytes !== "string" || bytes.length === 0) {
    throw new Error("recorded D1 recompiled snapshot must carry artifact bytes");
  }

  const parsed = JSON.parse(bytes) as unknown;
  const validation = validatePolicyArtifactV0(parsed);
  if (!validation.ok) {
    throw new Error(
      `recorded D1 recompiled snapshot artifact is invalid: ${validation.errors.join("; ")}`,
    );
  }

  return validation.artifact;
}

function hashPolicyAuthorReceiptHistorySummary(
  receiptHistory: readonly ReceiptV0[],
): ContentHashV0 {
  return hashCanonical(
    renderCanonical(
      receiptHistory.map((receipt) => ({
        content_hash: receipt.content_hash,
        contract_revision: receipt.core.contract_revision,
        as_of: receipt.core.as_of,
        role: receipt.core.role,
        event_cause: receipt.core.event_cause,
        verdict_status: receipt.verdict.status,
        next_forecast_recheck: receipt.freshness.next_forecast_recheck,
        surprise_cause: receipt.cost.surprise_cause,
      })),
    ),
  );
}

function countAuthorSessions(
  invocations: readonly RecordedPolicyRecompileAuthorInvocationV0[],
  agentExchanges: readonly RecordedPolicyRecompileAuthorAgentExchangeV0[],
): number {
  return invocations.length + Math.floor(agentExchanges.length / 2);
}

function assertRecompileDecision(
  decision: NormalizedPolicyRecompileDecisionV0,
  expected: PolicyRecompileDecisionOutcomeV0,
  scenario: RecordedPolicyRecompileD1ScenarioV0,
): void {
  if (decision.outcome !== expected) {
    throw new Error(
      `expected policy recompile decision ${expected}, received ${decision.outcome}`,
    );
  }
  if (
    decision.drift_outcome !== undefined &&
    decision.drift_outcome !== "tripped"
  ) {
    throw new Error(
      `policy recompile D1 must preserve tripped drift evidence, received ${decision.drift_outcome}`,
    );
  }
  if (decision.evidence_receipt_hashes.length === 0) {
    throw new Error("policy recompile D1 decision must expose drift evidence receipts");
  }

  const knownHashes = new Set(
    scenario.receipt_history.map((receipt) => receipt.content_hash),
  );
  const unknownHashes = decision.evidence_receipt_hashes.filter(
    (hash) => !knownHashes.has(hash),
  );
  if (unknownHashes.length > 0) {
    throw new Error(
      `policy recompile D1 decision referenced receipts outside the recorded log: ${unknownHashes.join(", ")}`,
    );
  }
}

function assertRecompileIntervalVariant(
  scenario: RecordedPolicyRecompileD1ScenarioV0,
  lastRecompileAt: string,
  variant: "allowed" | "blocked",
): void {
  const elapsedMs =
    parseReplayableInstantMs(scenario.as_of, "scenario.as_of") -
    parseReplayableInstantMs(lastRecompileAt, `scenario.${variant}_last_recompile_at`);
  if (variant === "allowed" && elapsedMs < scenario.min_recompile_interval_ms) {
    throw new Error("D1 allowed variant must be outside the min interval");
  }
  if (variant === "blocked" && elapsedMs >= scenario.min_recompile_interval_ms) {
    throw new Error("D1 blocked variant must be inside the min interval");
  }
}

function assertRegistrySnapshotMatchesScenario(
  snapshot: ReactorRegistrySnapshotV0,
  scenario: RecordedPolicyRecompileD1ScenarioV0,
): void {
  if (snapshot.policy_artifact_revision.length === 0) {
    throw new Error("policy recompile registry snapshot must name a revision");
  }
  if (snapshot.policy_artifact_namespace.length === 0) {
    throw new Error("policy recompile registry snapshot must name a namespace");
  }
  if (
    snapshot.contract_revision !== undefined &&
    snapshot.contract_revision !== scenario.contract_revision
  ) {
    throw new Error("policy recompile registry snapshot changed contract revision");
  }
  if (
    typeof snapshot.policy_artifact_bytes === "string" &&
    snapshot.policy_artifact_content_hash !== hashCanonical(snapshot.policy_artifact_bytes)
  ) {
    throw new Error("policy recompile registry snapshot content hash is stale");
  }
}

function assertPolicyAuthorInputMatchesScenario(
  input: unknown,
  scenario: RecordedPolicyRecompileD1ScenarioV0,
): void {
  if (!isRecord(input)) {
    throw new Error("policy recompile author input must be an object");
  }

  const responsibilityId = input["responsibility_id"];
  if (
    typeof responsibilityId === "string" &&
    responsibilityId !== scenario.responsibility_id
  ) {
    throw new Error("policy recompile author received the wrong responsibility");
  }

  const contractRevision = input["contract_revision"];
  if (
    typeof contractRevision === "string" &&
    contractRevision !== scenario.contract_revision
  ) {
    throw new Error("policy recompile author received the wrong contract revision");
  }

  const receiptValue = input["receipt_history"] ?? input["receipts"];
  if (!Array.isArray(receiptValue)) {
    throw new Error("policy recompile author must receive recorded receipt history");
  }
  const inputHashes = receiptValue.map((receipt, index) => {
    if (!isRecord(receipt) || typeof receipt["content_hash"] !== "string") {
      throw new Error(`policy recompile author receipt ${index} lacks content_hash`);
    }

    return receipt["content_hash"];
  });
  const scenarioHashes = scenario.receipt_history.map((receipt) => receipt.content_hash);
  if (inputHashes.join("\0") !== scenarioHashes.join("\0")) {
    throw new Error("policy recompile author received a different receipt history");
  }
}

function readRecompileOutcome(value: unknown): PolicyRecompileDecisionOutcomeV0 {
  if (
    value === "no-recompile-needed" ||
    value === "recompile-requested" ||
    value === "recompile-delayed" ||
    value === "needs-judgment"
  ) {
    return value;
  }

  throw new Error(
    "policy recompile decision outcome must be no-recompile-needed, recompile-requested, recompile-delayed, or needs-judgment",
  );
}

function readOptionalDriftOutcome(
  value: unknown,
): "not-tripped" | "tripped" | "indeterminate" | undefined {
  if (
    value === "not-tripped" ||
    value === "tripped" ||
    value === "indeterminate"
  ) {
    return value;
  }

  return undefined;
}

function readOptionalRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}

function readOptionalRegistrySnapshot(
  value: unknown,
): ReactorRegistrySnapshotV0 | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value["policy_artifact_namespace"] !== "string" ||
    typeof value["policy_artifact_revision"] !== "string"
  ) {
    return undefined;
  }

  return value as unknown as ReactorRegistrySnapshotV0;
}

function readContentHashArrayFromUnknown(
  value: unknown,
  label: string,
): readonly ContentHashV0[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  const hashes = value.map((item, index) => {
    if (typeof item !== "string" || !isContentHash(item)) {
      throw new Error(`${label}[${index}] must be a sha256 content hash`);
    }

    return item as ContentHashV0;
  });

  return Object.freeze(hashes);
}

function createCanonicalSnapshot<T>(
  value: T,
  label: string,
): {
  readonly value: T;
  readonly canonical: string;
  readonly hash: ContentHashV0;
} {
  try {
    const canonical = renderCanonical(value);
    return {
      value: JSON.parse(canonical) as T,
      canonical,
      hash: hashCanonical(canonical),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "canonicalization failed";
    throw new Error(`${label} must be canonical JSON: ${message}`);
  }
}

function cloneFromCanonical<T>(snapshot: { readonly canonical: string }): T {
  return JSON.parse(snapshot.canonical) as T;
}

function sanitizeForCanonical(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "function") {
    return "[function]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForCanonical(item));
  }
  if (isRecord(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      sanitized[key] = sanitizeForCanonical(child);
    }

    return sanitized;
  }

  return String(value);
}

function renderCanonical(value: unknown): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Cannot canonicalize non-finite numbers");
      }
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => renderCanonical(item)).join(",")}]`;
      }
      if (!isRecord(value)) {
        throw new TypeError("Cannot canonicalize non-plain objects");
      }
      return `{${Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => `${JSON.stringify(key)}:${renderCanonical(value[key])}`)
        .join(",")}}`;
    default:
      throw new TypeError(`Cannot canonicalize ${typeof value}`);
  }
}

function hashCanonical(canonical: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function isContentHash(value: string): value is ContentHashV0 {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function parseReplayableInstantMs(value: string, path: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`${path} must be a replayable UTC ISO instant`);
  }
  const ms = Date.parse(value);
  if (!Number.isSafeInteger(ms)) {
    throw new Error(`${path} must parse to a safe millisecond instant`);
  }

  return ms;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
