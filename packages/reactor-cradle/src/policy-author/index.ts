import { createHash } from "node:crypto";

import type { ContentHashV0, ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
  ReactorAgentSdkAdapterV0,
  ReactorRegistrySnapshotV0,
} from "@openprose/reactor/sdk";

export const POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0 =
  "openprose.reactor-cradle.policy-author-agent-cassette" as const;
export const POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0 = 0 as const;

export interface RecordedPolicyAuthorAgentExchangeV0 {
  readonly request: ReactorAgentRequestV0;
  readonly request_canonical: string;
  readonly request_hash: ContentHashV0;
  readonly response: ReactorAgentResponseV0;
  readonly response_canonical: string;
  readonly response_hash: ContentHashV0;
}

export interface PolicyAuthorAgentCassetteV0 {
  readonly schema: typeof POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0;
  readonly v: typeof POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0;
  readonly exchanges: readonly RecordedPolicyAuthorAgentExchangeV0[];
}

export interface PolicyAuthorAgentHandlerContextV0 {
  readonly exchange_index: number;
}

export type PolicyAuthorAgentHandlerV0 = (
  request: ReactorAgentRequestV0,
  context: PolicyAuthorAgentHandlerContextV0,
) => ReactorAgentResponseV0;

export interface RecordingPolicyAuthorAgentSdkV0 {
  readonly adapter: ReactorAgentSdkAdapterV0;
  readonly cassette: PolicyAuthorAgentCassetteV0;
  readonly launch_count: number;
}

export interface ReplayPolicyAuthorAgentSdkV0 {
  readonly adapter: ReactorAgentSdkAdapterV0;
  readonly launch_count: number;
  readonly remaining: number;
  readonly assertConsumed: () => void;
}

export interface PolicyAuthorContractRevisionV0 {
  readonly responsibility_id: string;
  readonly revision: ContentHashV0;
  readonly summary: string;
  readonly no_anchor: boolean;
}

export type PolicyLiveObservableSourceV0 =
  | "connector"
  | "receipt-log"
  | "kernel-backstop"
  | "cost-ledger"
  | "human-label-stream";

export interface PolicyLiveObservableV0 {
  readonly id: string;
  readonly source: PolicyLiveObservableSourceV0;
  readonly description: string;
}

export interface PolicyAuthorP1AuthorInputV0 {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly contract: PolicyAuthorContractRevisionV0;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly receipt_history: readonly ReceiptV0[];
  readonly receipts: readonly ReceiptV0[];
  readonly agentSdk: ReactorAgentSdkAdapterV0;
  readonly agent_sdk: ReactorAgentSdkAdapterV0;
  readonly as_of: string;
  readonly policy_artifact_namespace?: string;
}

export type AuthorPolicyArtifactV0 = (
  input: PolicyAuthorP1AuthorInputV0,
) => Promise<ReactorRegistrySnapshotV0> | ReactorRegistrySnapshotV0;

export interface RunRecordedPolicyAuthorP1ProofInputV0 {
  readonly authorPolicyArtifactV0: AuthorPolicyArtifactV0;
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly receipt_history: readonly ReceiptV0[];
  readonly as_of: string;
  readonly policy_artifact_namespace?: string;
  readonly handler: PolicyAuthorAgentHandlerV0;
}

export interface PolicyAuthorP1CassetteObservationV0 {
  readonly launch_count: number;
  readonly history_query_index: number;
  readonly artifact_authoring_index: number;
  readonly history_query_request_hash: ContentHashV0;
  readonly artifact_authoring_request_hash: ContentHashV0;
  readonly summary_only_history_query: true;
}

export interface PolicyAuthorRegistryReplayEvidenceV0 {
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly policy_artifact_content_hash: ContentHashV0;
  readonly validation_state: "validated";
  readonly artifact_bytes_canonical: true;
}

export interface RecordedPolicyAuthorP1ProofV0 {
  readonly cassette: PolicyAuthorAgentCassetteV0;
  readonly observation: PolicyAuthorP1CassetteObservationV0;
  readonly registry: PolicyAuthorRegistryReplayEvidenceV0;
  readonly recorded_snapshot: ReactorRegistrySnapshotV0;
  readonly replayed_snapshot: ReactorRegistrySnapshotV0;
  readonly recorded_snapshot_hash: ContentHashV0;
  readonly replayed_snapshot_hash: ContentHashV0;
  readonly replay_launch_count: number;
}

interface CanonicalSnapshotV0<T> {
  readonly value: T;
  readonly canonical: string;
  readonly hash: ContentHashV0;
}

export function createRecordingPolicyAuthorAgentSdkV0(
  handler: PolicyAuthorAgentHandlerV0,
): RecordingPolicyAuthorAgentSdkV0 {
  const exchanges: RecordedPolicyAuthorAgentExchangeV0[] = [];
  const adapter: ReactorAgentSdkAdapterV0 = {
    launch(request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
      assertPolicyAuthorRequest(request);

      const requestSnapshot = createCanonicalSnapshot(
        request,
        "policy author agent request",
      );
      const response = handler(cloneFromCanonical(requestSnapshot), {
        exchange_index: exchanges.length,
      });
      const responseSnapshot = createCanonicalSnapshot(
        response,
        "policy author agent response",
      );

      exchanges.push({
        request: requestSnapshot.value,
        request_canonical: requestSnapshot.canonical,
        request_hash: requestSnapshot.hash,
        response: responseSnapshot.value,
        response_canonical: responseSnapshot.canonical,
        response_hash: responseSnapshot.hash,
      });

      return cloneFromCanonical(responseSnapshot);
    },
  };

  return {
    adapter,
    get cassette(): PolicyAuthorAgentCassetteV0 {
      return clonePolicyAuthorAgentCassetteV0({
        schema: POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0,
        v: POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0,
        exchanges,
      });
    },
    get launch_count(): number {
      return exchanges.length;
    },
  };
}

export function createReplayPolicyAuthorAgentSdkV0(
  cassette: PolicyAuthorAgentCassetteV0,
): ReplayPolicyAuthorAgentSdkV0 {
  const replayCassette = clonePolicyAuthorAgentCassetteV0(cassette);
  let cursor = 0;

  const adapter: ReactorAgentSdkAdapterV0 = {
    launch(request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
      assertPolicyAuthorRequest(request);

      const expected = replayCassette.exchanges[cursor];
      if (expected === undefined) {
        throw new Error(
          `policy author replay exhausted at exchange ${cursor}; cassette has ${replayCassette.exchanges.length} exchanges`,
        );
      }

      const actual = createCanonicalSnapshot(
        request,
        "policy author replay request",
      );
      if (actual.canonical !== expected.request_canonical) {
        throw new Error(
          `unexpected policy author request at exchange ${cursor}: expected ${expected.request_hash}, received ${actual.hash}`,
        );
      }

      cursor += 1;
      return cloneFromCanonical({
        value: expected.response,
        canonical: expected.response_canonical,
        hash: expected.response_hash,
      });
    },
  };

  return {
    adapter,
    get launch_count(): number {
      return cursor;
    },
    get remaining(): number {
      return replayCassette.exchanges.length - cursor;
    },
    assertConsumed(): void {
      if (cursor !== replayCassette.exchanges.length) {
        throw new Error(
          `policy author replay stopped after ${cursor} of ${replayCassette.exchanges.length} recorded exchanges`,
        );
      }
    },
  };
}

export async function runRecordedPolicyAuthorP1ProofV0(
  input: RunRecordedPolicyAuthorP1ProofInputV0,
): Promise<RecordedPolicyAuthorP1ProofV0> {
  const recording = createRecordingPolicyAuthorAgentSdkV0(input.handler);
  const recordedSnapshot = await input.authorPolicyArtifactV0(
    buildAuthorInput(input, recording.adapter),
  );
  const cassette = recording.cassette;
  const observation = observePolicyAuthorP1CassetteV0(cassette);
  const registry = assertReplayableRegistrySnapshotV0(recordedSnapshot);

  const replay = createReplayPolicyAuthorAgentSdkV0(cassette);
  const replayedSnapshot = await input.authorPolicyArtifactV0(
    buildAuthorInput(input, replay.adapter),
  );
  replay.assertConsumed();

  const recordedSnapshotHash = hashCanonical(renderCanonical(recordedSnapshot));
  const replayedSnapshotHash = hashCanonical(renderCanonical(replayedSnapshot));
  if (recordedSnapshotHash !== replayedSnapshotHash) {
    throw new Error(
      `policy author replay changed registry snapshot: recorded ${recordedSnapshotHash}, replayed ${replayedSnapshotHash}`,
    );
  }

  assertReplayableRegistrySnapshotV0(replayedSnapshot);

  return {
    cassette,
    observation,
    registry,
    recorded_snapshot: recordedSnapshot,
    replayed_snapshot: replayedSnapshot,
    recorded_snapshot_hash: recordedSnapshotHash,
    replayed_snapshot_hash: replayedSnapshotHash,
    replay_launch_count: replay.launch_count,
  };
}

export function observePolicyAuthorP1CassetteV0(
  cassette: PolicyAuthorAgentCassetteV0,
): PolicyAuthorP1CassetteObservationV0 {
  const checkedCassette = clonePolicyAuthorAgentCassetteV0(cassette);
  if (checkedCassette.exchanges.length < 2) {
    throw new Error(
      "policy author P1 cassette must include at least history-query and artifact-authoring exchanges",
    );
  }

  const historyQueryIndex = checkedCassette.exchanges.findIndex((exchange) =>
    exchangeMatches(exchange, ["history-query", "history_query"]),
  );
  if (historyQueryIndex < 0) {
    throw new Error("policy author P1 cassette never requested receipt history");
  }

  const artifactAuthoringIndex = checkedCassette.exchanges.findIndex(
    (exchange, index) =>
      index > historyQueryIndex &&
      exchangeMatches(exchange, [
        "author-artifact",
        "artifact-authoring",
        "artifact_authoring",
        "authored-artifact",
        "authored_artifact",
        "policy_artifact",
      ]),
  );
  if (artifactAuthoringIndex < 0) {
    throw new Error(
      "policy author P1 cassette never authored an artifact after the history query",
    );
  }

  const historyExchange = readExchange(checkedCassette, historyQueryIndex);
  assertSummaryOnlyHistoryQuery(historyExchange);
  const artifactExchange = readExchange(checkedCassette, artifactAuthoringIndex);

  return {
    launch_count: checkedCassette.exchanges.length,
    history_query_index: historyQueryIndex,
    artifact_authoring_index: artifactAuthoringIndex,
    history_query_request_hash: historyExchange.request_hash,
    artifact_authoring_request_hash: artifactExchange.request_hash,
    summary_only_history_query: true,
  };
}

export function assertReplayableRegistrySnapshotV0(
  snapshot: ReactorRegistrySnapshotV0,
): PolicyAuthorRegistryReplayEvidenceV0 {
  const validationState =
    snapshot.policy_artifact_validation_state ?? snapshot.validation_state;
  const validationStatus =
    typeof validationState === "string"
      ? validationState
      : isPlainRecord(validationState)
        ? validationState["status"]
        : undefined;
  if (validationStatus !== "validated") {
    throw new Error("policy author registry snapshot must be validated");
  }
  if (snapshot.policy_artifact_namespace.length === 0) {
    throw new Error(
      "policy author registry snapshot must name a policy artifact namespace",
    );
  }
  if (snapshot.policy_artifact_revision.length === 0) {
    throw new Error(
      "policy author registry snapshot must name a policy artifact revision",
    );
  }

  const bytes = snapshot.policy_artifact_bytes;
  if (typeof bytes !== "string" || bytes.length === 0) {
    throw new Error(
      "policy author registry snapshot must carry canonical policy artifact bytes",
    );
  }

  const parsed = parseCanonicalJson(bytes, "policy artifact bytes");
  const rerendered = renderCanonical(parsed);
  if (rerendered !== bytes) {
    throw new Error("policy artifact bytes must already be canonical JSON");
  }

  const contentHash = hashCanonical(bytes);
  if (snapshot.policy_artifact_content_hash !== contentHash) {
    throw new Error(
      `policy artifact content hash mismatch: expected ${contentHash}, received ${snapshot.policy_artifact_content_hash ?? "undefined"}`,
    );
  }

  return {
    policy_artifact_namespace: snapshot.policy_artifact_namespace,
    policy_artifact_revision: snapshot.policy_artifact_revision,
    policy_artifact_content_hash: contentHash,
    validation_state: "validated",
    artifact_bytes_canonical: true,
  };
}

export function clonePolicyAuthorAgentCassetteV0(
  cassette: PolicyAuthorAgentCassetteV0,
): PolicyAuthorAgentCassetteV0 {
  if (cassette.schema !== POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0) {
    throw new Error(
      "policy author cassette schema must be openprose.reactor-cradle.policy-author-agent-cassette",
    );
  }
  if (cassette.v !== POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0) {
    throw new Error("policy author cassette version must be 0");
  }
  if (!Array.isArray(cassette.exchanges)) {
    throw new Error("policy author cassette exchanges must be an array");
  }

  return {
    schema: POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0,
    v: POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0,
    exchanges: cassette.exchanges.map((exchange, index) =>
      cloneExchange(exchange, index),
    ),
  };
}

function buildAuthorInput(
  input: RunRecordedPolicyAuthorP1ProofInputV0,
  agentSdk: ReactorAgentSdkAdapterV0,
): PolicyAuthorP1AuthorInputV0 {
  const contract: PolicyAuthorContractRevisionV0 = {
    responsibility_id: input.responsibility_id,
    revision: input.contract_revision,
    summary: input.contract_summary,
    no_anchor: input.no_anchor,
  };

  const authorInput: PolicyAuthorP1AuthorInputV0 = {
    responsibility_id: input.responsibility_id,
    contract_revision: input.contract_revision,
    contract_summary: input.contract_summary,
    contract,
    no_anchor: input.no_anchor,
    live_observables: input.live_observables,
    receipt_history: input.receipt_history,
    receipts: input.receipt_history,
    agentSdk,
    agent_sdk: agentSdk,
    as_of: input.as_of,
  };

  return input.policy_artifact_namespace === undefined
    ? authorInput
    : {
        ...authorInput,
        policy_artifact_namespace: input.policy_artifact_namespace,
      };
}

function cloneExchange(
  exchange: RecordedPolicyAuthorAgentExchangeV0,
  index: number,
): RecordedPolicyAuthorAgentExchangeV0 {
  const request = createCanonicalSnapshot(
    exchange.request,
    `policy author cassette exchange ${index} request`,
  );
  const response = createCanonicalSnapshot(
    exchange.response,
    `policy author cassette exchange ${index} response`,
  );
  assertPolicyAuthorRequest(request.value);

  assertStoredCanonical(
    exchange.request_canonical,
    request.canonical,
    `policy author cassette exchange ${index} request_canonical`,
  );
  assertStoredHash(
    exchange.request_hash,
    request.hash,
    `policy author cassette exchange ${index} request_hash`,
  );
  assertStoredCanonical(
    exchange.response_canonical,
    response.canonical,
    `policy author cassette exchange ${index} response_canonical`,
  );
  assertStoredHash(
    exchange.response_hash,
    response.hash,
    `policy author cassette exchange ${index} response_hash`,
  );

  return {
    request: request.value,
    request_canonical: request.canonical,
    request_hash: request.hash,
    response: response.value,
    response_canonical: response.canonical,
    response_hash: response.hash,
  };
}

function assertPolicyAuthorRequest(request: ReactorAgentRequestV0): void {
  if (request.kind !== "policy-author") {
    throw new Error(
      "policy-author Cradle double only handles policy-author agent launches",
    );
  }
}

function assertSummaryOnlyHistoryQuery(
  exchange: RecordedPolicyAuthorAgentExchangeV0,
): void {
  const request = exchange.request_canonical;
  const hasSummary =
    request.includes("receipt_summary") ||
    request.includes("receipt_summaries") ||
    request.includes("receipt_history_summary") ||
    request.includes("history_summary");
  if (!hasSummary) {
    throw new Error(
      "policy author history query must be launched from receipt summary only",
    );
  }

  if (
    request.includes('"schema":"openprose.receipt"') ||
    request.includes('"verdict":') ||
    request.includes('"freshness":') ||
    request.includes('"composition":') ||
    request.includes('"cost":')
  ) {
    throw new Error(
      "policy author history query must not receive full receipt bodies before selecting history",
    );
  }
}

function exchangeMatches(
  exchange: RecordedPolicyAuthorAgentExchangeV0,
  markers: readonly string[],
): boolean {
  const request = exchange.request_canonical;
  const response = exchange.response_canonical;

  return markers.some(
    (marker) => request.includes(marker) || response.includes(marker),
  );
}

function readExchange(
  cassette: PolicyAuthorAgentCassetteV0,
  index: number,
): RecordedPolicyAuthorAgentExchangeV0 {
  const exchange = cassette.exchanges[index];
  if (exchange === undefined) {
    throw new Error(`expected policy author exchange ${index}`);
  }

  return exchange;
}

function createCanonicalSnapshot<T>(
  value: T,
  label: string,
): CanonicalSnapshotV0<T> {
  try {
    const canonical = renderCanonical(value);
    return {
      value: parseCanonicalJson(canonical, label) as T,
      canonical,
      hash: hashCanonical(canonical),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "canonicalization failed";
    throw new Error(`${label} must be canonical JSON: ${message}`);
  }
}

function cloneFromCanonical<T>(snapshot: CanonicalSnapshotV0<T>): T {
  return parseCanonicalJson(snapshot.canonical, "canonical snapshot") as T;
}

function assertStoredCanonical(
  stored: string,
  actual: string,
  label: string,
): void {
  if (stored !== actual) {
    throw new Error(`${label} does not match canonical payload`);
  }
}

function assertStoredHash(
  stored: ContentHashV0,
  actual: ContentHashV0,
  label: string,
): void {
  if (stored !== actual) {
    throw new Error(`${label} does not match canonical payload hash`);
  }
}

function parseCanonicalJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "parse failed";
    throw new Error(`${label} must be JSON: ${message}`);
  }
}

function hashCanonical(canonical: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
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
      if (!isPlainRecord(value)) {
        throw new TypeError("Cannot canonicalize non-plain objects");
      }
      return renderCanonicalObject(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot canonicalize ${typeof value}`);
  }

  throw new TypeError("Cannot canonicalize unknown value");
}

function renderCanonicalObject(value: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${renderCanonical(entryValue)}`,
    )
    .join(",")}}`;
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
}
