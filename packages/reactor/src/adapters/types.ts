import type {
  ContentHashV0,
} from "../receipt";
import type {
  ReactorModelGatewayAdapterV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorModelGatewayUsageV0,
  ReactorRegistrySnapshotV0,
  ReactorStorageAdapterV0,
} from "../sdk";
import { cloneAdapterJsonValueV0 } from "./json";

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export interface ReactorRuntimeRegistrySnapshotV0
  extends ReactorRegistrySnapshotV0 {
  readonly [key: string]: unknown;
  readonly compiled_evidence_plan?: unknown;
  readonly forecast_schedule?: unknown;
}

export interface ReactorStorageRuntimeAdapterV0
  extends ReactorStorageAdapterV0 {
  readonly readRegistry: () => ReactorRuntimeRegistrySnapshotV0;
  readonly writeRegistry: (registry: ReactorRuntimeRegistrySnapshotV0) => void;
}

export interface ReactorModelGatewayResponseWithUsageV0
  extends ReactorModelGatewayResponseV0 {
  readonly usage: ReactorModelGatewayUsageV0;
}

export interface ReactorModelGatewayRuntimeAdapterV0
  extends ReactorModelGatewayAdapterV0 {
  readonly invoke: (
    request: ReactorModelGatewayRequestV0,
  ) => ReactorModelGatewayResponseWithUsageV0;
}

export const EMPTY_RUNTIME_REGISTRY_V0: ReactorRuntimeRegistrySnapshotV0 = {
  policy_artifact_namespace: "policy.uninitialized",
  policy_artifact_revision: "0",
};

export function cloneRuntimeRegistrySnapshotV0(
  registry: ReactorRuntimeRegistrySnapshotV0,
): ReactorRuntimeRegistrySnapshotV0 {
  const clone = cloneAdapterJsonValueV0(registry);
  assertRuntimeRegistrySnapshotV0(clone);
  return clone;
}

export function cloneModelGatewayUsageV0(
  usage: ReactorModelGatewayUsageV0,
): ReactorModelGatewayUsageV0 {
  const clone = cloneAdapterJsonValueV0(usage);
  assertModelGatewayUsageV0(clone);
  return clone;
}

export function assertRuntimeRegistrySnapshotV0(
  value: unknown,
): asserts value is ReactorRuntimeRegistrySnapshotV0 {
  if (!isRecord(value)) {
    throw new TypeError("registry snapshot must be an object");
  }

  const namespace = value["policy_artifact_namespace"];
  if (typeof namespace !== "string" || namespace.length === 0) {
    throw new TypeError(
      "registry.policy_artifact_namespace must be a non-empty string",
    );
  }

  const revision = value["policy_artifact_revision"];
  if (typeof revision !== "string" || revision.length === 0) {
    throw new TypeError(
      "registry.policy_artifact_revision must be a non-empty string",
    );
  }

  assertOptionalContentHash(value, "contract_revision");
  assertOptionalContentHash(value, "policy_artifact_content_hash");

  for (const key of [
    "policy_artifact_id",
    "policy_artifact_identity",
    "policy_artifact_bytes",
  ] as const) {
    const item = value[key];
    if (item !== undefined && typeof item !== "string") {
      throw new TypeError(`registry.${key} must be a string when present`);
    }
  }
}

export function assertModelGatewayUsageV0(
  value: unknown,
): asserts value is ReactorModelGatewayUsageV0 {
  if (!isRecord(value)) {
    throw new TypeError("model gateway usage must be an object");
  }

  for (const key of ["provider", "model"] as const) {
    const item = value[key];
    if (typeof item !== "string" || item.length === 0) {
      throw new TypeError(`usage.${key} must be a non-empty string`);
    }
  }

  const tokens = value["tokens"];
  if (!isRecord(tokens)) {
    throw new TypeError("usage.tokens must be an object");
  }

  assertNonNegativeSafeInteger(tokens, "fresh");
  assertNonNegativeSafeInteger(tokens, "reused");

  const providerNorm = value["provider_norm"];
  if (providerNorm !== undefined) {
    if (!isRecord(providerNorm)) {
      throw new TypeError("usage.provider_norm must be an object when present");
    }
    const schema = providerNorm["schema"];
    if (typeof schema !== "string" || schema.length === 0) {
      throw new TypeError("usage.provider_norm.schema must be non-empty");
    }
  }
}

function assertOptionalContentHash(
  record: Readonly<Record<string, unknown>>,
  key: string,
): void {
  const value = record[key];
  if (value !== undefined && !isContentHash(value)) {
    throw new TypeError(`registry.${key} must be a sha256 content address`);
  }
}

function assertNonNegativeSafeInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
): void {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`usage.tokens.${key} must be a non-negative safe integer`);
  }
}

function isContentHash(value: unknown): value is ContentHashV0 {
  return typeof value === "string" && CONTENT_HASH_PATTERN.test(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
