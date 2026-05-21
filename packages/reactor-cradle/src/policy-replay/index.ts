import type { AuthoredPolicyArtifactV0 } from "@openprose/reactor/policy";
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
  type NormalizedPolicyRecompileDecisionV0,
  type PlanPolicyRecompileV0,
  makeRecordedPolicyRecompileD1ScenarioV0,
  normalizePolicyRecompileDecisionV0,
} from "../recompile";

type ReactorPolicyModule = typeof import("@openprose/reactor/policy");

const { validatePolicyArtifactV0 } = loadReactorPolicy();

export const POLICY_REPLAY_P5_SCENARIO_SCHEMA_V0 =
  "openprose.reactor-cradle.policy-replay-p5-scenario" as const;
export const POLICY_REPLAY_P5_SCENARIO_VERSION_V0 = 0 as const;

export type PolicyReplayArtifactSourceV0 =
  "recorded-registry-snapshot-bytes";

export interface RecordedPolicyReplayP5ScenarioV0 {
  readonly schema: typeof POLICY_REPLAY_P5_SCENARIO_SCHEMA_V0;
  readonly v: typeof POLICY_REPLAY_P5_SCENARIO_VERSION_V0;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly as_of: string;
  readonly last_recompile_at: string;
  readonly last_policy_revalidated_at: string;
  readonly last_unforced_deep_at: string;
  readonly source_policy_loop: "p3-recorded-recompile";
  readonly receipt_history: readonly ReceiptV0[];
  readonly recorded_registry_snapshot: ReactorRegistrySnapshotV0;
  readonly recorded_policy_artifact_bytes: string;
  readonly recorded_policy_artifact_content_hash: ContentHashV0;
}

export interface RecordedPolicyArtifactReplayAuthorityV0 {
  readonly source: PolicyReplayArtifactSourceV0;
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly bytes: string;
  readonly content_hash: ContentHashV0;
  readonly byte_length: number;
  readonly namespace: string;
  readonly registry_id: string;
  readonly revision: string;
  readonly validation_state: "validated";
  readonly artifact_bytes_canonical: true;
  readonly content_hash_verified: true;
}

export type PolicyReplayForbiddenAuthorV0 = (
  input: unknown,
) => Promise<ReactorRegistrySnapshotV0> | ReactorRegistrySnapshotV0;

export interface PolicyReplayWithheldGatewayProbeV0 {
  readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly agent_sdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly model_gateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly authorPolicyArtifactV0: PolicyReplayForbiddenAuthorV0;
  readonly author_policy_artifact_v0: PolicyReplayForbiddenAuthorV0;
  readonly agent_launch_count: number;
  readonly model_gateway_invocation_count: number;
  readonly policy_author_invocation_count: number;
  readonly assertNoInvocations: () => void;
}

export interface RecordedPolicyReplayRunInputV0 {
  readonly artifact: AuthoredPolicyArtifactV0;
  readonly policy_artifact: AuthoredPolicyArtifactV0;
  readonly recorded_registry_snapshot: ReactorRegistrySnapshotV0;
  readonly recorded_artifact_bytes: string;
  readonly recorded_policy_artifact_bytes: string;
  readonly recorded_artifact_content_hash: ContentHashV0;
  readonly recorded_policy_artifact_content_hash: ContentHashV0;
  readonly receipt_history: readonly ReceiptV0[];
  readonly receipts: readonly ReceiptV0[];
  readonly as_of: string;
  readonly last_recompile_at: string;
  readonly last_policy_recompile_at: string;
  readonly last_policy_revalidated_at: string;
  readonly last_unforced_deep_at: string;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly author_input: {
    readonly responsibility_id: string;
    readonly contract_revision: ContentHashV0;
    readonly receipt_history: readonly ReceiptV0[];
    readonly receipts: readonly ReceiptV0[];
    readonly as_of: string;
    readonly policy_artifact_namespace: string;
    readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  };
  readonly agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly agent_sdk: Pick<ReactorAgentSdkAdapterV0, "launch">;
  readonly modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly model_gateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
  readonly authorPolicyArtifactV0: PolicyReplayForbiddenAuthorV0;
  readonly author_policy_artifact_v0: PolicyReplayForbiddenAuthorV0;
}

export type ReplayRecordedPolicyArtifactV0 = (
  input: RecordedPolicyReplayRunInputV0,
) => Promise<unknown> | unknown;

export interface RecordedPolicyReplayP5ProofV0 {
  readonly scenario: RecordedPolicyReplayP5ScenarioV0;
  readonly replay_authority: RecordedPolicyArtifactReplayAuthorityV0;
  readonly replay_decision: NormalizedPolicyRecompileDecisionV0;
  readonly raw_replay_result: unknown;
  readonly gateway_invocations: {
    readonly agent_launch_count: 0;
    readonly model_gateway_invocation_count: 0;
  };
  readonly policy_author_invocation_count: 0;
}

export interface RunRecordedPolicyReplayP5ProofInputV0 {
  readonly replayRecordedPolicyV0: ReplayRecordedPolicyArtifactV0;
  readonly scenario?: RecordedPolicyReplayP5ScenarioV0;
}

export function makeRecordedPolicyReplayP5ScenarioV0(): RecordedPolicyReplayP5ScenarioV0 {
  const recompileScenario = makeRecordedPolicyRecompileD1ScenarioV0();
  const recordedRegistrySnapshot = recompileScenario.recompiled_registry_snapshot;
  const authority =
    readRecordedPolicyArtifactFromRegistryV0(recordedRegistrySnapshot);

  return {
    schema: POLICY_REPLAY_P5_SCENARIO_SCHEMA_V0,
    v: POLICY_REPLAY_P5_SCENARIO_VERSION_V0,
    responsibility_id: recompileScenario.responsibility_id,
    contract_revision: recompileScenario.contract_revision,
    as_of: recompileScenario.as_of,
    last_recompile_at: recompileScenario.last_recompile_at_blocked,
    last_policy_revalidated_at: recompileScenario.last_recompile_at_blocked,
    last_unforced_deep_at: recompileScenario.last_recompile_at_blocked,
    source_policy_loop: "p3-recorded-recompile",
    receipt_history: recompileScenario.receipt_history,
    recorded_registry_snapshot: recordedRegistrySnapshot,
    recorded_policy_artifact_bytes: authority.bytes,
    recorded_policy_artifact_content_hash: authority.content_hash,
  };
}

export function assertRecordedPolicyReplayP5ScenarioV0(
  scenario: RecordedPolicyReplayP5ScenarioV0,
): void {
  if (scenario.schema !== POLICY_REPLAY_P5_SCENARIO_SCHEMA_V0) {
    throw new Error("policy replay P5 scenario schema is malformed");
  }
  if (scenario.v !== POLICY_REPLAY_P5_SCENARIO_VERSION_V0) {
    throw new Error("policy replay P5 scenario version must be 0");
  }
  if (scenario.source_policy_loop !== "p3-recorded-recompile") {
    throw new Error("policy replay P5 scenario must come from the recorded P3 recompile loop");
  }
  if (scenario.responsibility_id.length === 0) {
    throw new Error("policy replay P5 scenario responsibility_id is required");
  }
  if (!isContentHash(scenario.contract_revision)) {
    throw new Error("policy replay P5 scenario contract_revision must be a sha256 content hash");
  }
  parseReplayableInstantMs(scenario.as_of, "policy replay P5 scenario as_of");
  parseReplayableInstantMs(
    scenario.last_recompile_at,
    "policy replay P5 scenario last_recompile_at",
  );
  parseReplayableInstantMs(
    scenario.last_policy_revalidated_at,
    "policy replay P5 scenario last_policy_revalidated_at",
  );
  parseReplayableInstantMs(
    scenario.last_unforced_deep_at,
    "policy replay P5 scenario last_unforced_deep_at",
  );
  if (scenario.receipt_history.length === 0) {
    throw new Error("policy replay P5 scenario must include recorded receipt history");
  }

  const authority = readRecordedPolicyArtifactFromRegistryV0(
    scenario.recorded_registry_snapshot,
  );
  if (authority.bytes !== scenario.recorded_policy_artifact_bytes) {
    throw new Error(
      "policy replay P5 recorded artifact bytes must match the registry snapshot",
    );
  }
  if (
    authority.content_hash !== scenario.recorded_policy_artifact_content_hash
  ) {
    throw new Error(
      "policy replay P5 recorded artifact content hash must match the registry snapshot",
    );
  }
  if (authority.artifact.responsibility_id !== scenario.responsibility_id) {
    throw new Error("policy replay P5 artifact changed responsibility_id");
  }
  if (authority.artifact.provenance.contract_revision !== scenario.contract_revision) {
    throw new Error("policy replay P5 artifact changed contract_revision");
  }
}

export function readRecordedPolicyArtifactFromRegistryV0(
  snapshot: ReactorRegistrySnapshotV0,
): RecordedPolicyArtifactReplayAuthorityV0 {
  const validationStatus = readRegistryValidationStatus(snapshot);
  if (validationStatus !== "validated") {
    throw new Error("policy replay P5 registry snapshot must be validated");
  }

  const namespace = readNonEmptyString(
    snapshot.policy_artifact_namespace,
    "policy replay P5 registry namespace",
  );
  const revision = readNonEmptyString(
    snapshot.policy_artifact_revision,
    "policy replay P5 registry revision",
  );
  const bytes = readNonEmptyString(
    snapshot.policy_artifact_bytes,
    "policy replay P5 registry must carry recorded policy artifact bytes",
  );
  const contentHash = readContentHash(
    snapshot.policy_artifact_content_hash,
    "policy replay P5 registry must carry recorded policy artifact content hash",
  );
  const parsed = parseCanonicalJson(bytes, "policy replay P5 artifact bytes");
  const validation = validatePolicyArtifactV0(parsed);

  if (!validation.ok) {
    throw new Error(
      `policy replay P5 recorded artifact bytes are invalid: ${validation.errors.join("; ")}`,
    );
  }
  if (validation.bytes !== bytes) {
    throw new Error("policy replay P5 recorded artifact bytes are not canonical");
  }
  if (validation.content_hash !== contentHash) {
    throw new Error(
      `policy replay P5 recorded artifact content hash is stale: expected ${validation.content_hash}, received ${contentHash}`,
    );
  }
  if (validation.artifact.policy_revision !== revision) {
    throw new Error("policy replay P5 registry revision does not match recorded artifact bytes");
  }
  if (namespace !== validation.artifact.registry_id) {
    throw new Error("policy replay P5 registry namespace does not match recorded artifact bytes");
  }
  if (
    snapshot.contract_revision !== undefined &&
    snapshot.contract_revision !== validation.artifact.provenance.contract_revision
  ) {
    throw new Error("policy replay P5 registry contract revision does not match recorded artifact bytes");
  }
  if (
    snapshot.policy_artifact_id !== undefined &&
    snapshot.policy_artifact_id !== validation.artifact.registry_id
  ) {
    throw new Error("policy replay P5 registry artifact id does not match recorded artifact bytes");
  }
  if (
    snapshot.policy_artifact_identity !== undefined &&
    snapshot.policy_artifact_identity !== validation.artifact.registry_id
  ) {
    throw new Error("policy replay P5 registry artifact identity does not match recorded artifact bytes");
  }

  return {
    source: "recorded-registry-snapshot-bytes",
    artifact: validation.artifact,
    bytes: validation.bytes,
    content_hash: validation.content_hash,
    byte_length: Buffer.byteLength(validation.bytes, "utf8"),
    namespace,
    registry_id: validation.artifact.registry_id,
    revision,
    validation_state: "validated",
    artifact_bytes_canonical: true,
    content_hash_verified: true,
  };
}

export function createPolicyReplayP5WithheldGatewayProbeV0(): PolicyReplayWithheldGatewayProbeV0 {
  let agentLaunchCount = 0;
  let modelGatewayInvocationCount = 0;
  let policyAuthorInvocationCount = 0;

  const agentSdk: Pick<ReactorAgentSdkAdapterV0, "launch"> = {
    launch(_request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
      agentLaunchCount += 1;
      throw new Error("policy replay P5 proof must not launch agent SDK");
    },
  };
  const modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke"> = {
    invoke(_request: ReactorModelGatewayRequestV0): ReactorModelGatewayResponseV0 {
      modelGatewayInvocationCount += 1;
      throw new Error("policy replay P5 proof must not call model gateway");
    },
  };
  const authorPolicyArtifactV0: PolicyReplayForbiddenAuthorV0 = () => {
    policyAuthorInvocationCount += 1;
    throw new Error("policy replay P5 proof must not re-author policy artifacts");
  };

  return {
    agentSdk,
    agent_sdk: agentSdk,
    modelGateway,
    model_gateway: modelGateway,
    authorPolicyArtifactV0,
    author_policy_artifact_v0: authorPolicyArtifactV0,
    get agent_launch_count(): number {
      return agentLaunchCount;
    },
    get model_gateway_invocation_count(): number {
      return modelGatewayInvocationCount;
    },
    get policy_author_invocation_count(): number {
      return policyAuthorInvocationCount;
    },
    assertNoInvocations(): void {
      if (
        agentLaunchCount !== 0 ||
        modelGatewayInvocationCount !== 0 ||
        policyAuthorInvocationCount !== 0
      ) {
        throw new Error(
          `policy replay P5 proof invoked forbidden replay dependencies: agent=${agentLaunchCount}, model=${modelGatewayInvocationCount}, author=${policyAuthorInvocationCount}`,
        );
      }
    },
  };
}

export function createRecordedArtifactPolicyRecompileReplayV0(
  planPolicyRecompileV0: PlanPolicyRecompileV0,
): ReplayRecordedPolicyArtifactV0 {
  return (input: RecordedPolicyReplayRunInputV0): Promise<unknown> | unknown =>
    planPolicyRecompileV0({
      artifact: input.artifact,
      policy_artifact: input.artifact,
      receipts: input.receipt_history,
      receipt_history: input.receipt_history,
      as_of: input.as_of,
      last_recompile_at: input.last_recompile_at,
      last_policy_recompile_at: input.last_policy_recompile_at,
      last_policy_revalidated_at: input.last_policy_revalidated_at,
      last_unforced_deep_at: input.last_unforced_deep_at,
    });
}

export async function runRecordedPolicyReplayP5ProofV0(
  input: RunRecordedPolicyReplayP5ProofInputV0,
): Promise<RecordedPolicyReplayP5ProofV0> {
  const scenario = input.scenario ?? makeRecordedPolicyReplayP5ScenarioV0();
  assertRecordedPolicyReplayP5ScenarioV0(scenario);
  const authority = readRecordedPolicyArtifactFromRegistryV0(
    scenario.recorded_registry_snapshot,
  );
  const probe = createPolicyReplayP5WithheldGatewayProbeV0();
  const rawReplayResult = await input.replayRecordedPolicyV0(
    buildReplayRunInput(scenario, authority, probe),
  );
  const replayDecision = normalizePolicyRecompileDecisionV0(rawReplayResult);

  assertReplayDecisionMatchesRecordedArtifact(
    replayDecision,
    authority,
    scenario,
  );
  probe.assertNoInvocations();

  return {
    scenario,
    replay_authority: authority,
    replay_decision: replayDecision,
    raw_replay_result: rawReplayResult,
    gateway_invocations: {
      agent_launch_count: 0,
      model_gateway_invocation_count: 0,
    },
    policy_author_invocation_count: 0,
  };
}

function buildReplayRunInput(
  scenario: RecordedPolicyReplayP5ScenarioV0,
  authority: RecordedPolicyArtifactReplayAuthorityV0,
  probe: PolicyReplayWithheldGatewayProbeV0,
): RecordedPolicyReplayRunInputV0 {
  return {
    artifact: authority.artifact,
    policy_artifact: authority.artifact,
    recorded_registry_snapshot: scenario.recorded_registry_snapshot,
    recorded_artifact_bytes: authority.bytes,
    recorded_policy_artifact_bytes: authority.bytes,
    recorded_artifact_content_hash: authority.content_hash,
    recorded_policy_artifact_content_hash: authority.content_hash,
    receipt_history: scenario.receipt_history,
    receipts: scenario.receipt_history,
    as_of: scenario.as_of,
    last_recompile_at: scenario.last_recompile_at,
    last_policy_recompile_at: scenario.last_recompile_at,
    last_policy_revalidated_at: scenario.last_policy_revalidated_at,
    last_unforced_deep_at: scenario.last_unforced_deep_at,
    responsibility_id: scenario.responsibility_id,
    contract_revision: scenario.contract_revision,
    policy_artifact_namespace: authority.namespace,
    policy_artifact_revision: authority.revision,
    author_input: {
      responsibility_id: scenario.responsibility_id,
      contract_revision: scenario.contract_revision,
      receipt_history: scenario.receipt_history,
      receipts: scenario.receipt_history,
      as_of: scenario.as_of,
      policy_artifact_namespace: authority.namespace,
      agentSdk: probe.agentSdk,
    },
    agentSdk: probe.agentSdk,
    agent_sdk: probe.agent_sdk,
    modelGateway: probe.modelGateway,
    model_gateway: probe.model_gateway,
    authorPolicyArtifactV0: probe.authorPolicyArtifactV0,
    author_policy_artifact_v0: probe.author_policy_artifact_v0,
  };
}

function assertReplayDecisionMatchesRecordedArtifact(
  decision: NormalizedPolicyRecompileDecisionV0,
  authority: RecordedPolicyArtifactReplayAuthorityV0,
  scenario: RecordedPolicyReplayP5ScenarioV0,
): void {
  if (decision.outcome !== "recompile-delayed") {
    throw new Error(
      `policy replay P5 expected recorded artifact to replay to recompile-delayed, received ${decision.outcome}`,
    );
  }
  if (
    decision.drift_outcome !== undefined &&
    decision.drift_outcome !== "tripped"
  ) {
    throw new Error(
      `policy replay P5 must preserve tripped drift evidence, received ${decision.drift_outcome}`,
    );
  }
  if (decision.evidence_receipt_hashes.length === 0) {
    throw new Error("policy replay P5 decision must cite recorded receipt evidence");
  }

  const knownReceiptHashes = new Set(
    scenario.receipt_history.map((receipt) => receipt.content_hash),
  );
  const unknownHashes = decision.evidence_receipt_hashes.filter(
    (hash) => !knownReceiptHashes.has(hash),
  );
  if (unknownHashes.length > 0) {
    throw new Error(
      `policy replay P5 decision referenced receipts outside the recorded log: ${unknownHashes.join(", ")}`,
    );
  }

  const raw = readOptionalRecord(decision.raw);
  const rawHash = raw?.["policy_artifact_content_hash"];
  if (rawHash !== undefined && rawHash !== authority.content_hash) {
    throw new Error("policy replay P5 decision changed the artifact content hash");
  }
  const rawRevision = raw?.["policy_artifact_revision"];
  if (rawRevision !== undefined && rawRevision !== authority.revision) {
    throw new Error("policy replay P5 decision changed the artifact revision");
  }
}

function readRegistryValidationStatus(
  snapshot: ReactorRegistrySnapshotV0,
): unknown {
  const validationState =
    snapshot.policy_artifact_validation_state ?? snapshot.validation_state;

  return typeof validationState === "string"
    ? validationState
    : readOptionalRecord(validationState)?.["status"];
}

function parseCanonicalJson(value: string, label: string): unknown {
  try {
    const parsed = JSON.parse(value) as unknown;
    const rendered = renderCanonical(parsed);
    if (rendered !== value) {
      throw new Error("payload is not canonical JSON");
    }

    return parsed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "JSON parse failed";
    throw new Error(`${label} must be canonical JSON: ${message}`);
  }
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

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function readContentHash(value: unknown, label: string): ContentHashV0 {
  if (typeof value !== "string" || !isContentHash(value)) {
    throw new Error(`${label} must be a sha256 content hash`);
  }

  return value;
}

function parseReplayableInstantMs(value: string, label: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`${label} must be a replayable UTC ISO instant`);
  }
  const ms = Date.parse(value);
  if (!Number.isSafeInteger(ms)) {
    throw new Error(`${label} must parse to a safe millisecond instant`);
  }

  return ms;
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
