import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { assertReceiptV0, type ReceiptV0 } from "../../receipt";
import { cloneAdapterJsonValueV0, renderAdapterJsonV0 } from "../json";
import {
  EMPTY_RUNTIME_REGISTRY_V0,
  assertRuntimeRegistrySnapshotV0,
  cloneRuntimeRegistrySnapshotV0,
  type ReactorRuntimeRegistrySnapshotV0,
  type ReactorStorageRuntimeAdapterV0,
} from "../types";

export interface FileSystemStorageAdapterInputV0 {
  readonly directory: string;
  readonly registry_file?: string;
  readonly receipts_file?: string;
  readonly initial_registry?: ReactorRuntimeRegistrySnapshotV0;
}

export interface FileSystemStorageAdapterV0 extends ReactorStorageRuntimeAdapterV0 {
  readonly directory: string;
  readonly registryPath: string;
  readonly receiptsPath: string;
}

export function createFileSystemStorageAdapterV0(
  input: FileSystemStorageAdapterInputV0,
): FileSystemStorageAdapterV0 {
  if (input.directory.length === 0) {
    throw new Error("filesystem storage directory must be non-empty");
  }

  const registryPath = join(input.directory, input.registry_file ?? "registry.json");
  const receiptsPath = join(input.directory, input.receipts_file ?? "receipts.json");

  mkdirSync(input.directory, { recursive: true });
  initializeFile(
    registryPath,
    input.initial_registry ?? EMPTY_RUNTIME_REGISTRY_V0,
  );
  initializeFile(receiptsPath, []);

  return {
    directory: input.directory,
    registryPath,
    receiptsPath,
    appendReceipt(receipt: ReceiptV0): void {
      assertReceiptV0(receipt);
      const receipts = readReceiptLog(receiptsPath);
      writeJsonFile(receiptsPath, [...receipts, cloneReceipt(receipt)]);
    },
    listReceipts(): readonly ReceiptV0[] {
      return readReceiptLog(receiptsPath);
    },
    readRegistry(): ReactorRuntimeRegistrySnapshotV0 {
      const value = readJsonFile(registryPath);
      assertRuntimeRegistrySnapshotV0(value);
      return cloneRuntimeRegistrySnapshotV0(value);
    },
    writeRegistry(registry: ReactorRuntimeRegistrySnapshotV0): void {
      writeJsonFile(registryPath, cloneRuntimeRegistrySnapshotV0(registry));
    },
  };
}

function initializeFile(path: string, value: unknown): void {
  if (!existsSync(path)) {
    writeJsonFile(path, value);
  }
}

function readReceiptLog(path: string): readonly ReceiptV0[] {
  const value = readJsonFile(path);
  if (!Array.isArray(value)) {
    throw new Error("filesystem receipts file must contain an array");
  }

  return value.map((receipt) => cloneReceipt(receipt as ReceiptV0));
}

function cloneReceipt(receipt: ReceiptV0): ReceiptV0 {
  assertReceiptV0(receipt);
  const clone = cloneAdapterJsonValueV0(receipt);
  assertReceiptV0(clone);
  return clone;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeJsonFile(path: string, value: unknown): void {
  const tempPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tempPath, `${renderAdapterJsonV0(value)}\n`, "utf8");
  renameSync(tempPath, path);
}
