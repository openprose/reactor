import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorRegistrySnapshotV0,
  ReactorStorageAdapterV0,
} from "@openprose/reactor/sdk";

export interface FileSystemReactorStorageOptionsV0 {
  readonly rootDir: string;
  readonly registry?: ReactorRegistrySnapshotV0;
  readonly initialReceipts?: readonly ReceiptV0[];
}

export class InMemoryReactorStorage implements ReactorStorageAdapterV0 {
  readonly #receipts: ReceiptV0[];
  readonly #registry: ReactorRegistrySnapshotV0;

  constructor(
    registry: ReactorRegistrySnapshotV0,
    initialReceipts: readonly ReceiptV0[] = [],
  ) {
    this.#registry = cloneDeterministicJson(registry, "registry");
    this.#receipts = initialReceipts.map((receipt) =>
      cloneDeterministicJson(receipt, "receipt"),
    );
  }

  appendReceipt(receipt: ReceiptV0): void {
    this.#receipts.push(cloneDeterministicJson(receipt, "receipt"));
  }

  listReceipts(): readonly ReceiptV0[] {
    return deepFreezeJson(
      this.#receipts.map((receipt) => cloneDeterministicJson(receipt, "receipt")),
    );
  }

  readRegistry(): ReactorRegistrySnapshotV0 {
    return deepFreezeJson(cloneDeterministicJson(this.#registry, "registry"));
  }
}

export class FileSystemReactorStorage implements ReactorStorageAdapterV0 {
  static readonly registryFileName = "registry.json";
  static readonly receiptsFileName = "receipts.json";

  readonly #registryPath: string;
  readonly #receiptsPath: string;

  constructor(input: FileSystemReactorStorageOptionsV0) {
    assertNonEmptyString(input.rootDir, "rootDir");

    mkdirSync(input.rootDir, { recursive: true });
    this.#registryPath = join(
      input.rootDir,
      FileSystemReactorStorage.registryFileName,
    );
    this.#receiptsPath = join(
      input.rootDir,
      FileSystemReactorStorage.receiptsFileName,
    );

    if (input.registry !== undefined) {
      writeJsonFile(
        this.#registryPath,
        input.registry,
        FileSystemReactorStorage.registryFileName,
      );
    }

    const shouldInitializeReceipts =
      input.initialReceipts !== undefined ||
      (input.registry !== undefined && !existsSync(this.#receiptsPath));
    if (shouldInitializeReceipts) {
      writeJsonFile(
        this.#receiptsPath,
        input.initialReceipts ?? [],
        FileSystemReactorStorage.receiptsFileName,
      );
    }
  }

  appendReceipt(receipt: ReceiptV0): void {
    const receipts = readReceiptsFile(this.#receiptsPath);
    writeJsonFile(
      this.#receiptsPath,
      [...receipts, cloneDeterministicJson(receipt, "receipt")],
      FileSystemReactorStorage.receiptsFileName,
    );
  }

  listReceipts(): readonly ReceiptV0[] {
    return deepFreezeJson(readReceiptsFile(this.#receiptsPath));
  }

  readRegistry(): ReactorRegistrySnapshotV0 {
    return deepFreezeJson(readRegistryFile(this.#registryPath));
  }
}

function readRegistryFile(path: string): ReactorRegistrySnapshotV0 {
  const registry = readJsonRecordFile(
    path,
    FileSystemReactorStorage.registryFileName,
  );

  assertStringField(
    registry,
    "policy_artifact_namespace",
    "registry.policy_artifact_namespace",
  );
  assertStringField(
    registry,
    "policy_artifact_revision",
    "registry.policy_artifact_revision",
  );

  return registry as unknown as ReactorRegistrySnapshotV0;
}

function readReceiptsFile(path: string): ReceiptV0[] {
  const receipts = readJsonArrayFile(
    path,
    FileSystemReactorStorage.receiptsFileName,
  );

  receipts.forEach((receipt, index) => {
    if (!isPlainRecord(receipt)) {
      throw new Error(
        `filesystem storage ${FileSystemReactorStorage.receiptsFileName} entry ${index} must be a JSON object`,
      );
    }
    assertStringField(
      receipt,
      "content_hash",
      `receipts[${index}].content_hash`,
    );
  });

  return receipts as unknown as ReceiptV0[];
}

function readJsonRecordFile(
  path: string,
  label: string,
): Readonly<Record<string, unknown>> {
  const value = readJsonFile(path, label);
  if (!isPlainRecord(value)) {
    throw new Error(`filesystem storage ${label} must contain a JSON object`);
  }

  return value;
}

function readJsonArrayFile(path: string, label: string): unknown[] {
  const value = readJsonFile(path, label);
  if (!Array.isArray(value)) {
    throw new Error(`filesystem storage ${label} must contain a JSON array`);
  }

  return value;
}

function readJsonFile(path: string, label: string): unknown {
  let bytes: string;
  try {
    bytes = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(
      `filesystem storage ${label} read failed: ${errorMessage(error)}`,
    );
  }

  try {
    return JSON.parse(bytes) as unknown;
  } catch (error) {
    throw new Error(
      `filesystem storage ${label} must contain valid JSON: ${errorMessage(error)}`,
    );
  }
}

function writeJsonFile(path: string, value: unknown, label: string): void {
  try {
    writeFileSync(path, `${renderDeterministicJson(value)}\n`, "utf8");
  } catch (error) {
    throw new Error(
      `filesystem storage ${label} write failed: ${errorMessage(error)}`,
    );
  }
}

function cloneDeterministicJson<T>(value: T, label: string): T {
  try {
    return JSON.parse(renderDeterministicJson(value)) as T;
  } catch (error) {
    throw new Error(`${label} must be deterministic JSON: ${errorMessage(error)}`);
  }
}

function deepFreezeJson<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
    return Object.freeze(value) as T;
  }

  if (isPlainRecord(value)) {
    Object.values(value).forEach((item) => deepFreezeJson(item));
    return Object.freeze(value) as T;
  }

  return value;
}

function renderDeterministicJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
    case "number":
    case "string": {
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new TypeError("Cannot render non-finite numbers");
      }
      const rendered = JSON.stringify(value);
      if (rendered === undefined) {
        throw new TypeError(`Cannot render ${typeof value}`);
      }
      return rendered;
    }
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => renderDeterministicJson(item)).join(",")}]`;
      }
      if (!isPlainRecord(value)) {
        throw new TypeError("Cannot render non-plain objects");
      }
      return renderDeterministicJsonObject(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot render ${typeof value}`);
  }

  throw new TypeError("Cannot render unknown value");
}

function renderDeterministicJsonObject(
  value: Readonly<Record<string, unknown>>,
): string {
  const fields: string[] = [];

  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) {
      throw new TypeError(`Cannot render undefined field ${key}`);
    }
    fields.push(`${JSON.stringify(key)}:${renderDeterministicJson(item)}`);
  }

  return `{${fields.join(",")}}`;
}

function assertStringField(
  value: Readonly<Record<string, unknown>>,
  key: string,
  label: string,
): void {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`filesystem storage ${label} must be a non-empty string`);
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
