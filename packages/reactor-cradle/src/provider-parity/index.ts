import { createHash } from "node:crypto";

import type { ContentHashV0, ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  AuthorPolicyArtifactV0Input,
  PolicyAuthorHistoryQueryV0,
  PolicyLiveObservableV0,
} from "@openprose/reactor/policy";
import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
  ReactorAgentSdkAdapterV0,
  ReactorModelGatewayAdapterV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorModelGatewayUsageV0,
  ReactorRegistrySnapshotV0,
} from "@openprose/reactor/sdk";

export const PROVIDER_PARITY_GATEWAY_REQUEST_SCHEMA_V0 =
  "openprose.reactor-cradle.provider-parity.policy-author-gateway-request" as const;
export const PROVIDER_PARITY_REPORT_SCHEMA_V0 =
  "openprose.reactor-cradle.provider-parity.report" as const;
export const PROVIDER_PARITY_REPORT_VERSION_V0 = 0 as const;
export const PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0 =
  "agent-sdk-backed-by-model-gateway" as const;
const POLICY_ARTIFACT_VERSION = 0 as const;
const POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA =
  "openprose.reactor.policy-author.artifact-response" as const;
const POLICY_AUTHOR_HISTORY_QUERY_SCHEMA =
  "openprose.reactor.policy-author.history-query" as const;

type ReactorPolicyModuleV0 = typeof import("@openprose/reactor/policy");

export type ProviderParityPolicyAuthorStepV0 =
  | "history-query"
  | "author-artifact";

export type ProviderParityAuthorPolicyArtifactV0 = (
  input: AuthorPolicyArtifactV0Input,
) => Promise<ReactorRegistrySnapshotV0> | ReactorRegistrySnapshotV0;

export interface ProviderParityRecordedProviderV0 {
  readonly name: string;
  readonly model: string;
  readonly history_query: PolicyAuthorHistoryQueryV0;
  readonly artifact: unknown;
  readonly usage?: Partial<
    Record<ProviderParityPolicyAuthorStepV0, ReactorModelGatewayUsageV0>
  >;
}

export interface ProviderPolicyArtifactParityInputV0 {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly contract_summary: string;
  readonly no_anchor: boolean;
  readonly live_observables: readonly PolicyLiveObservableV0[];
  readonly receipt_history: readonly ReceiptV0[];
  readonly providers: readonly ProviderParityRecordedProviderV0[];
  readonly policy_artifact_namespace?: string;
  readonly authorPolicyArtifactV0?: ProviderParityAuthorPolicyArtifactV0;
}

export interface ProviderParityGatewayRequestPayloadV0 {
  readonly schema: typeof PROVIDER_PARITY_GATEWAY_REQUEST_SCHEMA_V0;
  readonly v: typeof PROVIDER_PARITY_REPORT_VERSION_V0;
  readonly provider_name: string;
  readonly launch_representation: typeof PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0;
  readonly agent_request: ReactorAgentRequestV0;
}

export interface ProviderParityModelGatewayCallV0 {
  readonly provider_name: string;
  readonly model: string;
  readonly step: ProviderParityPolicyAuthorStepV0;
  readonly request: ReactorModelGatewayRequestV0;
  readonly request_hash: ContentHashV0;
  readonly response: ReactorModelGatewayResponseV0;
  readonly response_hash: ContentHashV0;
  readonly usage: ReactorModelGatewayUsageV0;
}

export interface RecordedProviderModelGatewayV0
  extends ReactorModelGatewayAdapterV0 {
  readonly provider_name: string;
  readonly model: string;
  readonly calls: () => readonly ProviderParityModelGatewayCallV0[];
}

export interface ModelGatewayBackedPolicyAuthorAgentSdkV0 {
  readonly agentSdk: ReactorAgentSdkAdapterV0;
}

export interface ProviderParityProviderResultV0 {
  readonly provider_name: string;
  readonly model: string;
  readonly policy_author_launch_representation: typeof PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0;
  readonly validation_state: "validated";
  readonly artifact_hash: ContentHashV0;
  readonly artifact_bytes: string;
  readonly artifact_byte_length: number;
  readonly artifact_bytes_canonical: true;
  readonly policy_artifact_revision: string;
  readonly model_gateway_call_count: number;
  readonly model_gateway_request_hashes: readonly ContentHashV0[];
  readonly model_gateway_response_hashes: readonly ContentHashV0[];
  readonly model_gateway_usage: readonly ReactorModelGatewayUsageV0[];
}

export interface ProviderPolicyArtifactParityReportV0 {
  readonly schema: typeof PROVIDER_PARITY_REPORT_SCHEMA_V0;
  readonly v: typeof PROVIDER_PARITY_REPORT_VERSION_V0;
  readonly provider_names: readonly string[];
  readonly artifact_hashes: readonly ContentHashV0[];
  readonly artifact_bytes: readonly string[];
  readonly artifact_byte_lengths: readonly number[];
  readonly byte_identical: boolean;
  readonly validation_state: "validated";
  readonly providers: readonly ProviderParityProviderResultV0[];
}

interface CanonicalSnapshotV0<T> {
  readonly value: T;
  readonly canonical: string;
  readonly hash: ContentHashV0;
}

export async function runProviderPolicyArtifactParityV0(
  input: ProviderPolicyArtifactParityInputV0,
): Promise<ProviderPolicyArtifactParityReportV0> {
  validateParityInput(input);

  const authorPolicyArtifact =
    input.authorPolicyArtifactV0 ?? loadDefaultAuthorPolicyArtifactV0();
  const providers = assertProviderSet(input.providers);
  const results: ProviderParityProviderResultV0[] = [];

  for (const provider of providers) {
    const gateway = createRecordedProviderModelGatewayV0(provider);
    const bridge = createModelGatewayBackedPolicyAuthorAgentSdkV0({
      provider_name: provider.name,
      modelGateway: gateway,
    });
    const registry = await authorPolicyArtifact({
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      contract_summary: input.contract_summary,
      no_anchor: input.no_anchor,
      live_observables: input.live_observables,
      receipt_history: input.receipt_history,
      agentSdk: bridge.agentSdk,
      ...(input.policy_artifact_namespace === undefined
        ? {}
        : { policy_artifact_namespace: input.policy_artifact_namespace }),
    });

    results.push(snapshotProviderResult(provider, registry, gateway.calls()));
  }

  const baseline = readResult(results, 0);
  const byteIdentical = results.every(
    (result) => result.artifact_bytes === baseline.artifact_bytes,
  );

  return {
    schema: PROVIDER_PARITY_REPORT_SCHEMA_V0,
    v: PROVIDER_PARITY_REPORT_VERSION_V0,
    provider_names: results.map((result) => result.provider_name),
    artifact_hashes: results.map((result) => result.artifact_hash),
    artifact_bytes: results.map((result) => result.artifact_bytes),
    artifact_byte_lengths: results.map((result) => result.artifact_byte_length),
    byte_identical: byteIdentical,
    validation_state: "validated",
    providers: results,
  };
}

export async function assertProviderPolicyArtifactParityV0(
  input: ProviderPolicyArtifactParityInputV0,
): Promise<ProviderPolicyArtifactParityReportV0> {
  const report = await runProviderPolicyArtifactParityV0(input);
  return assertProviderPolicyArtifactParityReportV0(report);
}

export function assertProviderPolicyArtifactParityReportV0(
  report: ProviderPolicyArtifactParityReportV0,
): ProviderPolicyArtifactParityReportV0 {
  if (report.schema !== PROVIDER_PARITY_REPORT_SCHEMA_V0) {
    throw new Error("gateway-provider-parity report schema is invalid");
  }
  if (report.v !== PROVIDER_PARITY_REPORT_VERSION_V0) {
    throw new Error("gateway-provider-parity report version must be 0");
  }
  if (report.providers.length < 2) {
    throw new Error("gateway-provider-parity requires at least two providers");
  }
  if (report.validation_state !== "validated") {
    throw new Error("gateway-provider-parity did not validate all artifacts");
  }
  if (!report.byte_identical) {
    const details = report.providers
      .map((provider) => `${provider.provider_name}=${provider.artifact_hash}`)
      .join(", ");
    throw new Error(
      `gateway-provider-parity failed: policy artifact bytes differ (${details})`,
    );
  }

  return report;
}

export function createRecordedProviderModelGatewayV0(
  provider: ProviderParityRecordedProviderV0,
): RecordedProviderModelGatewayV0 {
  validateProvider(provider, new Set());
  const calls: ProviderParityModelGatewayCallV0[] = [];

  return {
    provider_name: provider.name,
    model: provider.model,
    invoke(request: ReactorModelGatewayRequestV0): ReactorModelGatewayResponseV0 {
      const requestSnapshot = createCanonicalSnapshot(
        request,
        "provider parity model gateway request",
      );
      const envelope = readProviderParityGatewayRequest(
        requestSnapshot.value,
        provider.name,
      );
      const step = readPolicyAuthorStep(envelope.agent_request);
      const usage = usageForProvider(provider, step, calls.length);
      const response = createProviderResponse(provider, step, usage);
      const responseSnapshot = createCanonicalSnapshot(
        response,
        "provider parity model gateway response",
      );

      calls.push({
        provider_name: provider.name,
        model: provider.model,
        step,
        request: requestSnapshot.value,
        request_hash: requestSnapshot.hash,
        response: responseSnapshot.value,
        response_hash: responseSnapshot.hash,
        usage,
      });

      return cloneFromCanonical(responseSnapshot);
    },
    calls(): readonly ProviderParityModelGatewayCallV0[] {
      return cloneJson(calls);
    },
  };
}

export function createModelGatewayBackedPolicyAuthorAgentSdkV0(input: {
  readonly provider_name: string;
  readonly modelGateway: Pick<ReactorModelGatewayAdapterV0, "invoke">;
}): ModelGatewayBackedPolicyAuthorAgentSdkV0 {
  assertNonEmptyString(input.provider_name, "provider_name");
  if (typeof input.modelGateway?.invoke !== "function") {
    throw new Error("modelGateway.invoke adapter is required");
  }

  return {
    agentSdk: {
      launch(request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
        if (request.kind !== "policy-author") {
          throw new Error("provider parity bridge only supports policy-author launches");
        }

        const response = input.modelGateway.invoke(
          buildProviderParityModelGatewayRequestV0({
            provider_name: input.provider_name,
            agent_request: request,
          }),
        );

        return {
          payload: response.payload,
        };
      },
    },
  };
}

export function buildProviderParityModelGatewayRequestV0(input: {
  readonly provider_name: string;
  readonly agent_request: ReactorAgentRequestV0;
}): ReactorModelGatewayRequestV0 {
  return {
    kind: "policy-compile",
    payload: {
      schema: PROVIDER_PARITY_GATEWAY_REQUEST_SCHEMA_V0,
      v: PROVIDER_PARITY_REPORT_VERSION_V0,
      provider_name: input.provider_name,
      launch_representation:
        PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0,
      agent_request: input.agent_request,
    } satisfies ProviderParityGatewayRequestPayloadV0,
  };
}

function snapshotProviderResult(
  provider: ProviderParityRecordedProviderV0,
  registry: ReactorRegistrySnapshotV0,
  calls: readonly ProviderParityModelGatewayCallV0[],
): ProviderParityProviderResultV0 {
  const validationState = readRegistryValidationState(registry);
  const artifactHash = readContentHash(
    registry.policy_artifact_content_hash,
    "registry.policy_artifact_content_hash",
  );
  const artifactBytes = readNonEmptyString(
    registry.policy_artifact_bytes,
    "registry.policy_artifact_bytes",
  );
  const policyArtifactRevision = readNonEmptyString(
    registry.policy_artifact_revision,
    "registry.policy_artifact_revision",
  );

  if (calls.length !== 2) {
    throw new Error(
      `${provider.name} policy author must use exactly two model gateway calls; observed ${calls.length}`,
    );
  }

  const steps = calls.map((call) => call.step).join(" -> ");
  if (steps !== "history-query -> author-artifact") {
    throw new Error(
      `${provider.name} policy author model gateway calls are out of order: ${steps}`,
    );
  }

  return {
    provider_name: provider.name,
    model: provider.model,
    policy_author_launch_representation:
      PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0,
    validation_state: validationState,
    artifact_hash: artifactHash,
    artifact_bytes: artifactBytes,
    artifact_byte_length: Buffer.byteLength(artifactBytes, "utf8"),
    artifact_bytes_canonical: true,
    policy_artifact_revision: policyArtifactRevision,
    model_gateway_call_count: calls.length,
    model_gateway_request_hashes: calls.map((call) => call.request_hash),
    model_gateway_response_hashes: calls.map((call) => call.response_hash),
    model_gateway_usage: calls.map((call) => call.usage),
  };
}

function createProviderResponse(
  provider: ProviderParityRecordedProviderV0,
  step: ProviderParityPolicyAuthorStepV0,
  usage: ReactorModelGatewayUsageV0,
): ReactorModelGatewayResponseV0 {
  if (step === "history-query") {
    return {
      payload: cloneJson(provider.history_query),
      usage,
    };
  }

  return {
    payload: {
      schema: POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
      v: POLICY_ARTIFACT_VERSION,
      artifact: cloneJson(provider.artifact),
    },
    usage,
  };
}

function usageForProvider(
  provider: ProviderParityRecordedProviderV0,
  step: ProviderParityPolicyAuthorStepV0,
  exchangeIndex: number,
): ReactorModelGatewayUsageV0 {
  const recordedUsage = provider.usage?.[step];
  if (recordedUsage !== undefined) {
    assertUsageMatchesProvider(recordedUsage, provider, step);
    return cloneJson(recordedUsage);
  }

  return {
    provider: provider.name,
    model: provider.model,
    tokens: step === "history-query"
      ? { fresh: 19, reused: 0 }
      : { fresh: 43, reused: 0 },
    provider_norm: {
      schema: "openprose.reactor-cradle.provider-parity.recorded-usage",
      provider_name: provider.name,
      model: provider.model,
      exchange_index: exchangeIndex,
      step,
    },
  };
}

function assertUsageMatchesProvider(
  usage: ReactorModelGatewayUsageV0,
  provider: ProviderParityRecordedProviderV0,
  step: ProviderParityPolicyAuthorStepV0,
): void {
  if (usage.provider !== provider.name) {
    throw new Error(
      `${provider.name} ${step} usage provider must match provider name`,
    );
  }
  if (usage.model !== provider.model) {
    throw new Error(`${provider.name} ${step} usage model must match model`);
  }
  if (!Number.isFinite(usage.tokens.fresh) || usage.tokens.fresh < 0) {
    throw new Error(`${provider.name} ${step} usage fresh tokens must be >= 0`);
  }
  if (!Number.isFinite(usage.tokens.reused) || usage.tokens.reused < 0) {
    throw new Error(`${provider.name} ${step} usage reused tokens must be >= 0`);
  }
}

function readProviderParityGatewayRequest(
  request: ReactorModelGatewayRequestV0,
  expectedProviderName: string,
): ProviderParityGatewayRequestPayloadV0 {
  if (request.kind !== "policy-compile") {
    throw new Error("provider parity gateway request kind must be policy-compile");
  }
  if (!isRecord(request.payload)) {
    throw new Error("provider parity gateway payload must be an object");
  }
  if (request.payload["schema"] !== PROVIDER_PARITY_GATEWAY_REQUEST_SCHEMA_V0) {
    throw new Error("provider parity gateway payload schema is invalid");
  }
  if (request.payload["v"] !== PROVIDER_PARITY_REPORT_VERSION_V0) {
    throw new Error("provider parity gateway payload version must be 0");
  }
  if (request.payload["provider_name"] !== expectedProviderName) {
    throw new Error(
      `provider parity gateway payload provider_name must be ${expectedProviderName}`,
    );
  }
  if (
    request.payload["launch_representation"] !==
    PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0
  ) {
    throw new Error("provider parity gateway launch representation is invalid");
  }

  const agentRequest = request.payload["agent_request"];
  if (!isRecord(agentRequest)) {
    throw new Error("provider parity gateway agent_request must be an object");
  }

  return {
    schema: PROVIDER_PARITY_GATEWAY_REQUEST_SCHEMA_V0,
    v: PROVIDER_PARITY_REPORT_VERSION_V0,
    provider_name: expectedProviderName,
    launch_representation:
      PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0,
    agent_request: agentRequest as unknown as ReactorAgentRequestV0,
  };
}

function readPolicyAuthorStep(
  request: ReactorAgentRequestV0,
): ProviderParityPolicyAuthorStepV0 {
  if (request.kind !== "policy-author") {
    throw new Error("provider parity gateway only accepts policy-author requests");
  }
  if (!isRecord(request.payload)) {
    throw new Error("policy-author payload must be an object");
  }
  const step = request.payload["step"];
  if (step === "history-query" || step === "author-artifact") {
    return step;
  }

  throw new Error("policy-author payload step must be history-query or author-artifact");
}

function validateParityInput(input: ProviderPolicyArtifactParityInputV0): void {
  assertNonEmptyString(input.responsibility_id, "responsibility_id");
  readContentHash(input.contract_revision, "contract_revision");
  assertNonEmptyString(input.contract_summary, "contract_summary");
  if (typeof input.no_anchor !== "boolean") {
    throw new Error("no_anchor must be boolean");
  }
  if (!Array.isArray(input.live_observables)) {
    throw new Error("live_observables must be an array");
  }
  if (!Array.isArray(input.receipt_history)) {
    throw new Error("receipt_history must be an array");
  }
  if (
    input.policy_artifact_namespace !== undefined &&
    input.policy_artifact_namespace.length === 0
  ) {
    throw new Error("policy_artifact_namespace must be non-empty when supplied");
  }
  if (
    input.authorPolicyArtifactV0 !== undefined &&
    typeof input.authorPolicyArtifactV0 !== "function"
  ) {
    throw new Error("authorPolicyArtifactV0 must be a function when supplied");
  }
}

function assertProviderSet(
  providers: readonly ProviderParityRecordedProviderV0[],
): readonly ProviderParityRecordedProviderV0[] {
  if (!Array.isArray(providers)) {
    throw new Error("providers must be an array");
  }
  if (providers.length < 2) {
    throw new Error("gateway-provider-parity requires at least two providers");
  }

  const names = new Set<string>();
  for (const provider of providers) {
    validateProvider(provider, names);
    names.add(provider.name);
  }

  return providers;
}

function validateProvider(
  provider: ProviderParityRecordedProviderV0,
  existingNames: ReadonlySet<string>,
): void {
  assertNonEmptyString(provider.name, "provider.name");
  if (existingNames.has(provider.name)) {
    throw new Error(`provider name must be unique: ${provider.name}`);
  }
  assertNonEmptyString(provider.model, `${provider.name}.model`);
  if (provider.history_query.schema !== POLICY_AUTHOR_HISTORY_QUERY_SCHEMA) {
    throw new Error(
      `${provider.name}.history_query schema must be ${POLICY_AUTHOR_HISTORY_QUERY_SCHEMA}`,
    );
  }
  if (provider.history_query.v !== POLICY_ARTIFACT_VERSION) {
    throw new Error(`${provider.name}.history_query version must be 0`);
  }
  if (!Array.isArray(provider.history_query.selected_receipt_hashes)) {
    throw new Error(`${provider.name}.history_query selected hashes must be an array`);
  }
  cloneJson(provider.artifact);
}

function readResult(
  results: readonly ProviderParityProviderResultV0[],
  index: number,
): ProviderParityProviderResultV0 {
  const result = results[index];
  if (result === undefined) {
    throw new Error(`expected provider parity result ${index}`);
  }

  return result;
}

function readRegistryValidationState(
  registry: ReactorRegistrySnapshotV0,
): "validated" {
  const state =
    registry.policy_artifact_validation_state ?? registry.validation_state;
  if (isRecord(state) && state["status"] === "validated") {
    return "validated";
  }
  if (state === "validated") {
    return "validated";
  }

  throw new Error("registry policy artifact validation state must be validated");
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function readNonEmptyString(value: unknown, label: string): string {
  assertNonEmptyString(value, label);
  return value;
}

function readContentHash(value: unknown, label: string): ContentHashV0 {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a sha256 content address`);
  }

  return value as ContentHashV0;
}

function createCanonicalSnapshot<T>(
  value: T,
  label: string,
): CanonicalSnapshotV0<T> {
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

function cloneFromCanonical<T>(snapshot: CanonicalSnapshotV0<T>): T {
  return JSON.parse(snapshot.canonical) as T;
}

function cloneJson<T>(value: T): T {
  return cloneFromCanonical(createCanonicalSnapshot(value, "provider parity JSON"));
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
      if (!isRecord(value)) {
        throw new TypeError("Cannot canonicalize non-plain object");
      }
      return `{${Object.keys(value)
        .sort()
        .map((key) => {
          const item = value[key];
          if (item === undefined) {
            throw new TypeError(`Cannot canonicalize undefined field ${key}`);
          }
          return `${JSON.stringify(key)}:${renderCanonical(item)}`;
        })
        .join(",")}}`;
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot canonicalize ${typeof value}`);
  }

  throw new TypeError("Cannot canonicalize unknown value");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadDefaultAuthorPolicyArtifactV0(): ProviderParityAuthorPolicyArtifactV0 {
  return loadReactorPolicy().authorPolicyArtifactV0;
}

function loadReactorPolicy(): ReactorPolicyModuleV0 {
  try {
    return require("@openprose/reactor/policy") as ReactorPolicyModuleV0;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/policy")) {
      return require("../../../reactor/dist/policy") as ReactorPolicyModuleV0;
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
