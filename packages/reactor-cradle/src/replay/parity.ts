import { createHash } from "node:crypto";

import type { ContentHashV0 } from "@openprose/reactor/receipt";

export const REPLAY_COMPARABLE_OUTPUT_SCHEMA_V0 =
  "openprose.reactor-cradle.replay-comparable-output" as const;
export const REPLAY_COMPARABLE_OUTPUT_VERSION_V0 = 0 as const;
export const REPLAY_PARITY_MATRIX_SCHEMA_V0 =
  "openprose.reactor-cradle.replay-parity-matrix" as const;
export const REPLAY_PARITY_MATRIX_VERSION_V0 = 0 as const;

export type ReplayComparableJsonValueV0 =
  | null
  | boolean
  | number
  | string
  | readonly ReplayComparableJsonValueV0[]
  | { readonly [key: string]: ReplayComparableJsonValueV0 };

export interface ReplayComparableScenarioOutputInputV0 {
  readonly scenario_id: string;
  readonly world_profile: string;
  readonly cassette_path: string;
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly trace: unknown;
  readonly receipt_log: unknown;
  readonly expected_relationships?: unknown;
  readonly decisions?: unknown;
  readonly registry?: unknown;
}

export interface ReplayComparableScenarioOutputV0 {
  readonly schema: typeof REPLAY_COMPARABLE_OUTPUT_SCHEMA_V0;
  readonly v: typeof REPLAY_COMPARABLE_OUTPUT_VERSION_V0;
  readonly scenario_id: string;
  readonly world_profile: string;
  readonly cassette_path: string;
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly trace: ReplayComparableJsonValueV0;
  readonly receipt_log: ReplayComparableJsonValueV0;
  readonly expected_relationships: ReplayComparableJsonValueV0;
  readonly decisions?: ReplayComparableJsonValueV0;
  readonly registry?: ReplayComparableJsonValueV0;
}

export interface ReplayComparableSnapshotV0 {
  readonly output: ReplayComparableScenarioOutputV0;
  readonly bytes: string;
  readonly content_hash: ContentHashV0;
  readonly byte_length: number;
}

export type ReplayByteIdenticalCheckV0 =
  | ReplayByteIdenticalPassV0
  | ReplayByteIdenticalFailV0;

export interface ReplayByteIdenticalPassV0 {
  readonly ok: true;
  readonly relationship: "replay-byte-identical";
  readonly expected_hash: ContentHashV0;
  readonly actual_hash: ContentHashV0;
  readonly byte_length: number;
  readonly evidence_path: "$";
}

export interface ReplayByteIdenticalFailV0 {
  readonly ok: false;
  readonly relationship: "replay-byte-identical";
  readonly expected_hash: ContentHashV0;
  readonly actual_hash: ContentHashV0;
  readonly expected_bytes: string;
  readonly actual_bytes: string;
  readonly evidence_path: "$";
  readonly reason: string;
}

export type ReplayParityAdapterNameV0 =
  | "deterministic-in-memory"
  | "filesystem"
  | "postgres";
export type ReplayParityStorageAdapterV0 = "memory" | "fs" | "pg";
export type ReplayParityAdapterStatusV0 = "ready" | "future";

export interface ReplayParityAdapterRowV0 {
  readonly name: ReplayParityAdapterNameV0;
  readonly storage_adapter: ReplayParityStorageAdapterV0;
  readonly status: ReplayParityAdapterStatusV0;
  readonly reason: string;
}

export const REPLAY_PARITY_MATRIX_ROWS_V0: readonly ReplayParityAdapterRowV0[] =
  Object.freeze([
    Object.freeze({
      name: "deterministic-in-memory",
      storage_adapter: "memory",
      status: "ready",
      reason: "C3 deterministic row backed by in-memory doubles",
    }),
    Object.freeze({
      name: "filesystem",
      storage_adapter: "fs",
      status: "ready",
      reason: "durable filesystem adapter row backed by deterministic JSON files",
    }),
    Object.freeze({
      name: "postgres",
      storage_adapter: "pg",
      status: "future",
      reason: "future Postgres adapter parity row; not implemented in C3",
    }),
  ] satisfies readonly ReplayParityAdapterRowV0[]);

export interface ReplayParityMatrixInputV0 {
  readonly baseline: ReplayComparableScenarioOutputInputV0;
  readonly rows?: readonly ReplayParityAdapterRowV0[];
  readonly runAdapter: (
    row: ReplayParityAdapterRowV0,
  ) => ReplayComparableScenarioOutputInputV0;
}

export interface ReplayParityMatrixResultV0 {
  readonly schema: typeof REPLAY_PARITY_MATRIX_SCHEMA_V0;
  readonly v: typeof REPLAY_PARITY_MATRIX_VERSION_V0;
  readonly relationship: "cross-adapter-parity";
  readonly ok: boolean;
  readonly ready_rows_run: number;
  readonly future_rows: number;
  readonly rows: readonly ReplayParityRowResultV0[];
}

export type ReplayParityRowResultV0 =
  | ReplayParityReadyPassV0
  | ReplayParityReadyFailV0
  | ReplayParityFutureRowV0;

export interface ReplayParityReadyPassV0 {
  readonly adapter_name: ReplayParityAdapterNameV0;
  readonly storage_adapter: ReplayParityStorageAdapterV0;
  readonly status: "passed";
  readonly check: ReplayByteIdenticalPassV0;
}

export interface ReplayParityReadyFailV0 {
  readonly adapter_name: ReplayParityAdapterNameV0;
  readonly storage_adapter: ReplayParityStorageAdapterV0;
  readonly status: "failed";
  readonly reason: string;
  readonly check?: ReplayByteIdenticalFailV0;
}

export interface ReplayParityFutureRowV0 {
  readonly adapter_name: ReplayParityAdapterNameV0;
  readonly storage_adapter: ReplayParityStorageAdapterV0;
  readonly status: "future";
  readonly reason: string;
}

interface CanonicalSnapshotV0<T> {
  readonly value: T;
  readonly canonical: string;
  readonly hash: ContentHashV0;
}

export function createReplayComparableOutputV0(
  input: ReplayComparableScenarioOutputInputV0,
): ReplayComparableScenarioOutputV0 {
  assertNonEmptyString(input.scenario_id, "scenario_id");
  assertNonEmptyString(input.world_profile, "world_profile");
  assertNonEmptyString(input.cassette_path, "cassette_path");
  assertNonEmptyString(input.initial_instant, "initial_instant");
  assertNonEmptyString(input.final_instant, "final_instant");

  const base = {
    schema: REPLAY_COMPARABLE_OUTPUT_SCHEMA_V0,
    v: REPLAY_COMPARABLE_OUTPUT_VERSION_V0,
    scenario_id: input.scenario_id,
    world_profile: input.world_profile,
    cassette_path: input.cassette_path,
    initial_instant: input.initial_instant,
    final_instant: input.final_instant,
    trace: toComparableJsonValue(input.trace, "trace"),
    receipt_log: toComparableJsonValue(input.receipt_log, "receipt_log"),
    expected_relationships: toComparableJsonValue(
      input.expected_relationships ?? [],
      "expected_relationships",
    ),
  };

  return {
    ...base,
    ...(input.decisions === undefined
      ? {}
      : { decisions: toComparableJsonValue(input.decisions, "decisions") }),
    ...(input.registry === undefined
      ? {}
      : { registry: toComparableJsonValue(input.registry, "registry") }),
  };
}

export function snapshotReplayComparableOutputV0(
  input: ReplayComparableScenarioOutputInputV0,
): ReplayComparableSnapshotV0 {
  const output = createReplayComparableOutputV0(input);
  const bytes = renderCanonical(output);

  return {
    output,
    bytes,
    content_hash: hashCanonical(bytes),
    byte_length: Buffer.byteLength(bytes, "utf8"),
  };
}

export function compareReplayByteIdenticalV0(
  expected: ReplayComparableScenarioOutputInputV0,
  actual: ReplayComparableScenarioOutputInputV0,
): ReplayByteIdenticalCheckV0 {
  const expectedSnapshot = snapshotReplayComparableOutputV0(expected);
  const actualSnapshot = snapshotReplayComparableOutputV0(actual);

  if (expectedSnapshot.bytes === actualSnapshot.bytes) {
    return {
      ok: true,
      relationship: "replay-byte-identical",
      expected_hash: expectedSnapshot.content_hash,
      actual_hash: actualSnapshot.content_hash,
      byte_length: expectedSnapshot.byte_length,
      evidence_path: "$",
    };
  }

  return {
    ok: false,
    relationship: "replay-byte-identical",
    expected_hash: expectedSnapshot.content_hash,
    actual_hash: actualSnapshot.content_hash,
    expected_bytes: expectedSnapshot.bytes,
    actual_bytes: actualSnapshot.bytes,
    evidence_path: "$",
    reason: "comparable scenario output bytes differ",
  };
}

export function assertReplayByteIdenticalV0(
  expected: ReplayComparableScenarioOutputInputV0,
  actual: ReplayComparableScenarioOutputInputV0,
): ReplayByteIdenticalPassV0 {
  const check = compareReplayByteIdenticalV0(expected, actual);
  if (!check.ok) {
    throw new Error(
      `replay-byte-identical failed: expected ${check.expected_hash}, received ${check.actual_hash}`,
    );
  }

  return check;
}

export function runReplayParityMatrixV0(
  input: ReplayParityMatrixInputV0,
): ReplayParityMatrixResultV0 {
  const rows = input.rows ?? REPLAY_PARITY_MATRIX_ROWS_V0;
  const results = rows.map((row) => runParityRow(row, input));
  const readyRowsRun = results.filter(
    (result) => result.status === "passed" || result.status === "failed",
  ).length;
  const futureRows = results.filter((result) => result.status === "future").length;
  const failedRows = results.filter((result) => result.status === "failed");

  return {
    schema: REPLAY_PARITY_MATRIX_SCHEMA_V0,
    v: REPLAY_PARITY_MATRIX_VERSION_V0,
    relationship: "cross-adapter-parity",
    ok: readyRowsRun > 0 && failedRows.length === 0,
    ready_rows_run: readyRowsRun,
    future_rows: futureRows,
    rows: Object.freeze(results),
  };
}

export function assertReplayParityMatrixV0(
  input: ReplayParityMatrixInputV0,
): ReplayParityMatrixResultV0 {
  const result = runReplayParityMatrixV0(input);
  if (!result.ok) {
    throw new Error("cross-adapter-parity failed");
  }

  return result;
}

function runParityRow(
  row: ReplayParityAdapterRowV0,
  input: ReplayParityMatrixInputV0,
): ReplayParityRowResultV0 {
  if (row.status === "future") {
    return {
      adapter_name: row.name,
      storage_adapter: row.storage_adapter,
      status: "future",
      reason: row.reason,
    };
  }

  try {
    const check = compareReplayByteIdenticalV0(
      input.baseline,
      input.runAdapter(row),
    );
    if (check.ok) {
      return {
        adapter_name: row.name,
        storage_adapter: row.storage_adapter,
        status: "passed",
        check,
      };
    }

    return {
      adapter_name: row.name,
      storage_adapter: row.storage_adapter,
      status: "failed",
      reason: check.reason,
      check,
    };
  } catch (error) {
    return {
      adapter_name: row.name,
      storage_adapter: row.storage_adapter,
      status: "failed",
      reason: error instanceof Error ? error.message : "adapter row failed",
    };
  }
}

function toComparableJsonValue(
  value: unknown,
  label: string,
): ReplayComparableJsonValueV0 {
  return createCanonicalSnapshot(value, label).value;
}

function createCanonicalSnapshot<T>(
  value: T,
  label: string,
): CanonicalSnapshotV0<ReplayComparableJsonValueV0> {
  try {
    const canonical = renderCanonical(value);
    return {
      value: JSON.parse(canonical) as ReplayComparableJsonValueV0,
      canonical,
      hash: hashCanonical(canonical),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "canonicalization failed";
    throw new Error(`${label} must be comparable canonical JSON: ${message}`);
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
  const fields: string[] = [];

  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) {
      throw new TypeError(`Cannot canonicalize undefined field ${key}`);
    }
    fields.push(`${JSON.stringify(key)}:${renderCanonical(item)}`);
  }

  return `{${fields.join(",")}}`;
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

function isPlainRecord(
  value: object,
): value is Readonly<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
