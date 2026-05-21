import { assertReceiptV0, type ReceiptV0 } from "../../receipt";
import {
  EMPTY_RUNTIME_REGISTRY_V0,
  cloneRuntimeRegistrySnapshotV0,
  type ReactorRuntimeRegistrySnapshotV0,
  type ReactorStorageRuntimeAdapterV0,
} from "../types";
import { cloneAdapterJsonValueV0 } from "../json";

export interface MemoryStorageAdapterInputV0 {
  readonly registry?: ReactorRuntimeRegistrySnapshotV0;
  readonly receipts?: readonly ReceiptV0[];
}

export interface MemoryStorageAdapterV0 extends ReactorStorageRuntimeAdapterV0 {
  readonly clear: () => void;
}

export function createMemoryStorageAdapterV0(
  input: MemoryStorageAdapterInputV0 = {},
): MemoryStorageAdapterV0 {
  let registry = cloneRuntimeRegistrySnapshotV0(
    input.registry ?? EMPTY_RUNTIME_REGISTRY_V0,
  );
  let receipts = (input.receipts ?? []).map((receipt) => cloneReceipt(receipt));

  return {
    appendReceipt(receipt: ReceiptV0): void {
      receipts = [...receipts, cloneReceipt(receipt)];
    },
    listReceipts(): readonly ReceiptV0[] {
      return receipts.map((receipt) => cloneReceipt(receipt));
    },
    readRegistry(): ReactorRuntimeRegistrySnapshotV0 {
      return cloneRuntimeRegistrySnapshotV0(registry);
    },
    writeRegistry(nextRegistry: ReactorRuntimeRegistrySnapshotV0): void {
      registry = cloneRuntimeRegistrySnapshotV0(nextRegistry);
    },
    clear(): void {
      registry = cloneRuntimeRegistrySnapshotV0(EMPTY_RUNTIME_REGISTRY_V0);
      receipts = [];
    },
  };
}

function cloneReceipt(receipt: ReceiptV0): ReceiptV0 {
  assertReceiptV0(receipt);
  const clone = cloneAdapterJsonValueV0(receipt);
  assertReceiptV0(clone);
  return clone;
}
