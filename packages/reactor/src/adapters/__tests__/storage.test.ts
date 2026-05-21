import { deepEqual, equal } from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createForecastRecheckReceiptV0 } from "../../forecast";
import type { ReceiptRecheckKindV0, ReceiptV0 } from "../../receipt";
import { renderAdapterJsonV0 } from "../json";
import { createFileSystemStorageAdapterV0 } from "../storage-fs";
import { createMemoryStorageAdapterV0 } from "../storage-memory";
import type { ReactorRuntimeRegistrySnapshotV0 } from "../types";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const POLICY_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;

test("memory storage round-trips registry hydration and receipt append", () => {
  const first = makeReceipt("2026-05-18T12:00:00Z", "evidence-age");
  const second = makeReceipt("2026-05-18T12:05:00Z", "plan-age");
  const storage = createMemoryStorageAdapterV0({
    registry: makeRegistry("1"),
    receipts: [first],
  });

  deepEqual(storage.readRegistry(), makeRegistry("1"));

  const hydrated = makeRegistry("2");
  storage.writeRegistry(hydrated);
  storage.appendReceipt(second);

  deepEqual(storage.readRegistry(), hydrated);
  deepEqual(storage.listReceipts(), [first, second]);

  const returnedRegistry = storage.readRegistry() as Record<string, unknown>;
  returnedRegistry["policy_artifact_namespace"] = "policy.tampered";
  equal(storage.readRegistry().policy_artifact_namespace, "policy.test");
});

test("filesystem storage round-trips deterministic JSON and registry hydration", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "reactor-adapters-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const first = makeReceipt("2026-05-18T12:00:00Z", "evidence-age");
  const second = makeReceipt("2026-05-18T12:05:00Z", "plan-age");
  const hydrated = makeRegistry("2");
  const storage = createFileSystemStorageAdapterV0({
    directory,
    initial_registry: makeRegistry("1"),
  });

  storage.appendReceipt(first);
  storage.writeRegistry(hydrated);
  storage.appendReceipt(second);

  const reopened = createFileSystemStorageAdapterV0({ directory });

  deepEqual(reopened.readRegistry(), hydrated);
  deepEqual(reopened.listReceipts(), [first, second]);
  equal(
    readFileSync(join(directory, "registry.json"), "utf8"),
    `${renderAdapterJsonV0(hydrated)}\n`,
  );
  equal(
    readFileSync(join(directory, "receipts.json"), "utf8"),
    `${renderAdapterJsonV0([first, second])}\n`,
  );
});

function makeRegistry(revision: string): ReactorRuntimeRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    policy_artifact_id: "policy.test.registry-row",
    policy_artifact_identity: "policy.test",
    policy_artifact_namespace: "policy.test",
    policy_artifact_revision: revision,
    policy_artifact_validation_state: {
      status: "validated",
      validator_id: "adapter-storage-test",
    },
    validation_state: {
      status: "validated",
      validator_id: "adapter-storage-test",
    },
    policy_artifact_content_hash: POLICY_HASH,
    compiled_evidence_plan: {
      schema: "openprose.test.compiled-evidence-plan",
      source_ids: ["source.release-risk"],
    },
    forecast_schedule: {
      next_evidence_recheck: "2026-05-18T13:00:00Z",
      next_plan_recheck: "2026-05-19T12:00:00Z",
    },
  };
}

function makeReceipt(
  asOf: string,
  recheckKind: ReceiptRecheckKindV0,
): ReceiptV0 {
  return createForecastRecheckReceiptV0({
    responsibility_id: "responsibility.adapter-storage",
    contract_revision: CONTRACT_HASH,
    memo_key: `memo-${recheckKind}-${asOf}`,
    evidence_input_ids: [EVIDENCE_HASH],
    as_of: asOf,
    recheck_kind: recheckKind,
  });
}
