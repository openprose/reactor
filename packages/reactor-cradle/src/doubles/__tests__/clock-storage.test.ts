import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { ContentHashV0, ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorClockAdapterV0,
  ReactorRegistrySnapshotV0,
  ReactorStorageAdapterV0,
} from "@openprose/reactor/sdk";

import { VirtualClock } from "../clock";
import { FileSystemReactorStorage, InMemoryReactorStorage } from "../storage";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const POLICY_ARTIFACT_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const RECEIPT_A_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const RECEIPT_B_HASH =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

test("VirtualClock exposes deterministic SDK clock time", () => {
  const clock = new VirtualClock("2026-05-18T12:00:00Z");
  const adapter: ReactorClockAdapterV0 = clock;

  equal(adapter.now(), "2026-05-18T12:00:00.000Z");
  equal(adapter.now(), "2026-05-18T12:00:00.000Z");

  clock.advanceMs(1_250);
  equal(adapter.now(), "2026-05-18T12:00:01.250Z");

  clock.advanceMs(0);
  equal(adapter.now(), "2026-05-18T12:00:01.250Z");

  clock.set("2026-05-18T13:14:15.123Z");
  equal(adapter.now(), "2026-05-18T13:14:15.123Z");
});

test("VirtualClock rejects invalid advances without moving time", () => {
  const clock = new VirtualClock("2026-05-18T12:00:00Z");

  for (const ms of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    9_007_199_254_740_992,
  ]) {
    throws(
      () => clock.advanceMs(ms),
      /non-negative safe integer millisecond interval/,
      String(ms),
    );
    equal(clock.now(), "2026-05-18T12:00:00.000Z", String(ms));
  }
});

test("VirtualClock rejects invalid replay instants without moving time", () => {
  const clock = new VirtualClock("2026-05-18T12:00:00Z");

  throws(
    () => new VirtualClock("not-an-instant"),
    /ISO-8601 UTC instant/,
  );

  for (const instant of [
    "2026-05-18",
    "2026-05-18T12:00:00-07:00",
    "2026-02-30T12:00:00Z",
  ]) {
    throws(() => clock.set(instant), /ISO-8601 UTC instant/, instant);
    equal(clock.now(), "2026-05-18T12:00:00.000Z", instant);
  }
});

test("InMemoryReactorStorage appends and lists receipts in insertion order", () => {
  const first = makeReceipt(
    "receipt-a",
    "2026-05-18T12:00:00Z",
    RECEIPT_A_HASH,
  );
  const second = makeReceipt(
    "receipt-b",
    "2026-05-18T12:01:00Z",
    RECEIPT_B_HASH,
  );
  const storage: ReactorStorageAdapterV0 = new InMemoryReactorStorage(
    makeRegistry(),
    [first],
  );

  storage.appendReceipt(second);

  deepEqual(storage.listReceipts(), [first, second]);
});

test("InMemoryReactorStorage reads the configured registry snapshot", () => {
  const registry = makeRegistry({
    policy_artifact_namespace: "policy.test",
    policy_artifact_revision: "revision-2",
  });
  const storage = new InMemoryReactorStorage(registry);
  const snapshot = storage.readRegistry();

  deepEqual(snapshot, registry);
  ok(Object.isFrozen(snapshot));

  throws(
    () => {
      (snapshot as { policy_artifact_revision: string }).policy_artifact_revision =
        "tampered";
    },
    TypeError,
  );
  deepEqual(storage.readRegistry(), registry);
});

test("InMemoryReactorStorage listReceipts returns immutable snapshots", () => {
  const first = makeReceipt(
    "receipt-a",
    "2026-05-18T12:00:00Z",
    RECEIPT_A_HASH,
  );
  const second = makeReceipt(
    "receipt-b",
    "2026-05-18T12:01:00Z",
    RECEIPT_B_HASH,
  );
  const seed: ReceiptV0[] = [first];
  const storage = new InMemoryReactorStorage(makeRegistry(), seed);

  seed.push(second);
  const snapshot = storage.listReceipts();

  ok(Object.isFrozen(snapshot));
  deepEqual(snapshot, [first]);

  throws(() => {
    (snapshot as ReceiptV0[]).push(second);
  }, TypeError);

  storage.appendReceipt(second);

  deepEqual(snapshot, [first]);
  deepEqual(storage.listReceipts(), [first, second]);
});

test("FileSystemReactorStorage persists deterministic JSON files and reopens them", () => {
  const rootDir = makeTempDir();
  try {
    const registry = makeRegistry();
    const first = makeReceipt(
      "receipt-a",
      "2026-05-18T12:00:00Z",
      RECEIPT_A_HASH,
    );
    const second = makeReceipt(
      "receipt-b",
      "2026-05-18T12:01:00Z",
      RECEIPT_B_HASH,
    );
    const storage: ReactorStorageAdapterV0 = new FileSystemReactorStorage({
      rootDir,
      registry,
      initialReceipts: [first],
    });

    storage.appendReceipt(second);

    equal(
      readFileSync(
        join(rootDir, FileSystemReactorStorage.registryFileName),
        "utf8",
      ),
      [
        `{"contract_revision":"${CONTRACT_HASH}"`,
        `,"policy_artifact_content_hash":"${POLICY_ARTIFACT_HASH}"`,
        ',"policy_artifact_id":"policy.incident-briefing"',
        ',"policy_artifact_identity":"policy.incident-briefing"',
        ',"policy_artifact_namespace":"policy.static"',
        ',"policy_artifact_revision":"revision-1"',
        ',"policy_artifact_validation_state":"validated"',
        ',"validation_state":"validated"}\n',
      ].join(""),
    );

    const receiptBytes = readFileSync(
      join(rootDir, FileSystemReactorStorage.receiptsFileName),
      "utf8",
    );
    ok(receiptBytes.startsWith('[{"composition":'));
    deepEqual(JSON.parse(receiptBytes) as unknown, [first, second]);

    const reopened = new FileSystemReactorStorage({ rootDir });
    const registrySnapshot = reopened.readRegistry();
    const receiptsSnapshot = reopened.listReceipts();
    const firstReceiptSnapshot = receiptsSnapshot[0];

    deepEqual(registrySnapshot, registry);
    deepEqual(receiptsSnapshot, [first, second]);
    ok(Object.isFrozen(registrySnapshot));
    ok(Object.isFrozen(receiptsSnapshot));
    ok(firstReceiptSnapshot !== undefined);
    ok(Object.isFrozen(firstReceiptSnapshot));
    ok(Object.isFrozen(firstReceiptSnapshot.core));

    throws(() => {
      (receiptsSnapshot as ReceiptV0[]).push(second);
    }, TypeError);
    throws(() => {
      (firstReceiptSnapshot.core as { memo_key: string }).memo_key = "tampered";
    }, TypeError);

    deepEqual(reopened.listReceipts(), [first, second]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("FileSystemReactorStorage fails closed on missing or malformed durable files", () => {
  const rootDir = makeTempDir();
  try {
    const storage = new FileSystemReactorStorage({ rootDir });
    const receipt = makeReceipt(
      "receipt-a",
      "2026-05-18T12:00:00Z",
      RECEIPT_A_HASH,
    );

    throws(() => storage.readRegistry(), /registry\.json read failed/);
    throws(() => storage.listReceipts(), /receipts\.json read failed/);
    throws(() => storage.appendReceipt(receipt), /receipts\.json read failed/);

    writeFileSync(
      join(rootDir, FileSystemReactorStorage.registryFileName),
      "[]\n",
      "utf8",
    );
    throws(
      () => storage.readRegistry(),
      /registry\.json must contain a JSON object/,
    );

    writeFileSync(
      join(rootDir, FileSystemReactorStorage.registryFileName),
      '{"policy_artifact_namespace":"policy.static"}\n',
      "utf8",
    );
    throws(
      () => storage.readRegistry(),
      /registry\.policy_artifact_revision/,
    );

    writeFileSync(
      join(rootDir, FileSystemReactorStorage.receiptsFileName),
      "{}\n",
      "utf8",
    );
    throws(
      () => storage.listReceipts(),
      /receipts\.json must contain a JSON array/,
    );

    writeFileSync(
      join(rootDir, FileSystemReactorStorage.receiptsFileName),
      "[{}]\n",
      "utf8",
    );
    throws(() => storage.listReceipts(), /receipts\[0\]\.content_hash/);

    writeFileSync(
      join(rootDir, FileSystemReactorStorage.receiptsFileName),
      "not-json\n",
      "utf8",
    );
    throws(() => storage.listReceipts(), /receipts\.json must contain valid JSON/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

function makeRegistry(
  overrides: Partial<ReactorRegistrySnapshotV0> = {},
): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    policy_artifact_id: "policy.incident-briefing",
    policy_artifact_identity: "policy.incident-briefing",
    policy_artifact_namespace: "policy.static",
    policy_artifact_revision: "revision-1",
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    ...overrides,
  };
}

function makeReceipt(
  memoKey: string,
  asOf: string,
  contentHash: ContentHashV0,
): ReceiptV0 {
  return {
    schema: "openprose.receipt",
    v: 0,
    hash_algorithm: "sha256",
    content_hash: contentHash,
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      event_cause: "real-input",
      memo_key: memoKey,
      evidence_input_ids: [EVIDENCE_HASH],
      as_of: asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "cradle in-memory storage test fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 1,
        derivation_method: "cradle-fixture",
        calibration_grade: "none",
        label_source: "fixture",
      },
    },
    freshness: {
      as_of: asOf,
      next_forecast_recheck: asOf,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "fixture",
      model: "deterministic",
      role: "judge",
      tags: ["cradle-storage-test"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: `run-${memoKey}`,
      as_of: asOf,
      tokens: { fresh: 0, reused: 0 },
      surprise_cause: "real-input",
    },
  } satisfies ReceiptV0;
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "reactor-cradle-storage-"));
}
